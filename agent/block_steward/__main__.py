"""CLI: python -m block_steward {suggest,brief,run-once,loop} [--sink] [--areas] [--today]."""
from __future__ import annotations

import argparse
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from . import db
from .briefing import build_briefing
from .config import load_settings
from .gemini import make_gemini
from .sinks import DryRunSink, HttpSink
from .suggest import suggest
from .timeutil import LOCAL_TZ

OUT_DIR = Path(__file__).resolve().parents[1] / "out"
SUGGEST_AT = (7, 0)   # daily, Vancouver time
BRIEF_AT = (8, 0)     # Mondays, Vancouver time


def log(msg: str) -> None:
    print(f"{datetime.now(LOCAL_TZ):%Y-%m-%d %H:%M:%S} {msg}", flush=True)


def make_sink(settings, name):
    if name == "http":
        missing = [k for k, v in (("AGENT_API_BASE_URL", settings.api_base_url),
                                  ("AUTH0_DOMAIN", settings.auth0_domain),
                                  ("AUTH0_CLIENT_ID", settings.auth0_client_id),
                                  ("AUTH0_CLIENT_SECRET", settings.auth0_client_secret)) if not v]
        if missing:
            raise SystemExit("http sink needs: " + ", ".join(missing))
        return HttpSink(settings.api_base_url, settings.auth0_domain, settings.auth0_client_id,
                        settings.auth0_client_secret, settings.auth0_audience)
    return DryRunSink(OUT_DIR)


def run_suggest(settings, sink, areas, today):
    conn = db.connect(settings)
    try:
        hotspots = db.help_hotspots(conn, areas)
        events = db.upcoming_events(conn, today, 14)
        orgs = db.orgs(conn)
    finally:
        conn.close()
    payloads = suggest(hotspots, events, orgs, today, areas=areas)
    log(f"suggest: {len(hotspots)} hotspots, {len(events)} upcoming events, "
        f"{len(orgs)} orgs -> {len(payloads)} suggestions")
    for p in payloads:
        sink.send(p)
    return len(payloads)


def run_brief(settings, sink, areas, today):
    conn = db.connect(settings)
    try:
        hotspots = db.help_hotspots(conn, areas)
        if not areas:
            areas = sorted({h["local_area"] for h in hotspots if h["local_area"]})
        events = db.upcoming_events(conn, today, 14)
        summaries = {r["local_area"]: r for r in db.area_summaries(conn, areas)}
        track2 = {a: db.top_track2(conn, a, 5) for a in areas}
    finally:
        conn.close()
    llm = make_gemini(settings.gemini_api_key, settings.gemini_model) if settings.gemini_api_key else None
    sent = 0
    for area in areas:
        area_hot = [h for h in hotspots if h["local_area"] == area]
        area_events = [e for e in events if e.get("local_area") == area]
        payload = build_briefing(area, summaries.get(area), area_events, track2[area],
                                 area_hot, today, llm)
        log(f"brief: {area}: {len(area_hot)} hotspots, {len(area_events)} events, "
            f"{len(track2[area])} open issues, model={payload['model']}")
        sink.send(payload)
        sent += 1
    log(f"brief: {sent} briefings")
    return sent


def _next_run(now, hm, weekday=None):
    run = now.replace(hour=hm[0], minute=hm[1], second=0, microsecond=0)
    while run <= now or (weekday is not None and run.weekday() != weekday):
        run = (run + timedelta(days=1)).replace(hour=hm[0], minute=hm[1])
    return run


def run_loop(settings, sink, areas, today_override=None):
    schedule = {"suggest": (SUGGEST_AT, None), "brief": (BRIEF_AT, 0)}
    jobs = {"suggest": run_suggest, "brief": run_brief}
    nxt = {n: _next_run(datetime.now(LOCAL_TZ), hm, wd) for n, (hm, wd) in schedule.items()}
    log(f"loop: next suggest {nxt['suggest']:%Y-%m-%d %H:%M}, "
        f"next brief {nxt['brief']:%Y-%m-%d %H:%M} (Vancouver)")
    while True:
        name = min(nxt, key=nxt.get)
        wait = (nxt[name] - datetime.now(LOCAL_TZ)).total_seconds()
        if wait > 0:
            time.sleep(min(wait, 300))
            continue
        try:
            jobs[name](settings, sink, areas, today_override or datetime.now(LOCAL_TZ).date())
        except Exception as exc:  # keep the loop alive; never log secrets
            log(f"loop: {name} failed: {type(exc).__name__}: {str(exc)[:200]}")
        hm, wd = schedule[name]
        nxt[name] = _next_run(datetime.now(LOCAL_TZ), hm, wd)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="block_steward")
    ap.add_argument("command", choices=["suggest", "brief", "run-once", "loop"])
    ap.add_argument("--sink", choices=["dry-run", "http"])
    ap.add_argument("--areas", help='comma list, e.g. "Mount Pleasant,Strathcona"')
    ap.add_argument("--today", help="YYYY-MM-DD (demos and tests)")
    args = ap.parse_args(argv)

    settings = load_settings()
    sink = make_sink(settings, args.sink or settings.sink)
    areas = [a.strip() for a in args.areas.split(",") if a.strip()] if args.areas else settings.areas
    override = date.fromisoformat(args.today) if args.today else None
    today = override or datetime.now(LOCAL_TZ).date()

    if args.command == "loop":
        run_loop(settings, sink, areas, override)
    if args.command in ("suggest", "run-once"):
        run_suggest(settings, sink, areas, today)
    if args.command in ("brief", "run-once"):
        run_brief(settings, sink, areas, today)
    return 0


if __name__ == "__main__":
    sys.exit(main())
