"""Weekly briefing: facts from data, optional LLM wording, deterministic template fallback.

build_briefing(area, summary_row, upcoming_events, top_track2, hotspots, today, llm=None)
returns the briefing payload (see agent/README.md contract). llm is a callable
prompt -> text; any failure or invalid reply falls back to the template.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import date, timedelta

from .programs import is_graffiti
from .timeutil import as_date
from .wording import plain_words

AUTHOR = "block-steward-agent"
EVENT_WINDOW_DAYS = 7
MAX_EVENTS = 3
MAX_ISSUES = 3
MAX_HOTSPOT_TYPES = 3
MAX_WORDS = 120
MAX_CHARS = 1200
_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _day(value) -> str:
    d = as_date(value)
    return f"{_DAYS[d.weekday()]}, {_MONTHS[d.month - 1]} {d.day}"


def _n(n: int, unit: str) -> str:
    return f"{n} {unit}" if n == 1 else f"{n} {unit}s"


def _cap(text: str) -> str:
    return text[:1].upper() + text[1:]


def _facts(area, summary_row, events, issues, hotspots, today) -> dict:
    summary = ((summary_row or {}).get("summary") or "").strip()
    upcoming = []
    for e in events:
        if e.get("local_area") != area or e.get("done_at") is not None or not e.get("starts_at"):
            continue
        if 0 <= (as_date(e["starts_at"]) - today).days <= EVENT_WINDOW_DAYS:
            upcoming.append(e)
    upcoming.sort(key=lambda e: e["starts_at"])
    top = sorted(issues, key=lambda i: i.get("base_score") or 0, reverse=True)[:MAX_ISSUES]
    counts = Counter(h["request_type"] for h in hotspots)
    types = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:MAX_HOTSPOT_TYPES]
    return {"summary": summary, "events": upcoming[:MAX_EVENTS], "issues": top, "hotspot_types": types}


def _event_text(e) -> str:
    text = f"{e['title']} on {_day(e['starts_at'])}"
    if e.get("organiser"):
        text += f", organised by {e['organiser']}"
    return text


def _issue_text(i) -> str:
    what = _cap(plain_words(i["request_type"]))
    where = f" at {i['address']}" if i.get("address") else ""
    return (f"{what}{where}: {_n(int(i['open_cases']), 'open case')}, "
            f"open for {_n(int(i['days_open']), 'day')}")


def _hotspot_text(types) -> str:
    return ", ".join(f"{_n(c, 'spot')} for {plain_words(rt)}" for rt, c in types)


def _template(area, f) -> str:
    # Paragraph 1: help this week
    p1 = [f"Here is what is happening in {area} this week."]
    if f["summary"]:
        p1.append(f["summary"])
    if f["events"]:
        lines = "\n".join(f"- {_event_text(e)}" for e in f["events"])
        p1.append("Coming up in the next 7 days:\n" + lines)
    else:
        p1.append("No neighbour events are planned in the next 7 days yet.")
    if f["hotspot_types"]:
        p1.append("Spots that keep getting reported to 311 here: "
                  + _hotspot_text(f["hotspot_types"]) + ".")
    # Paragraph 2: City-only issues
    if f["issues"]:
        lines = "\n".join(f"- {_issue_text(i)}" for i in f["issues"])
        p2 = ("These open issues are for the City to fix. Voting on them shows how much "
              "they matter to neighbours:\n" + lines)
    else:
        p2 = "No open City-only issues stand out in your area right now. Thank you for keeping watch."
    # Paragraph 3: one way to help
    if f["events"]:
        p3 = (f"One way to help: join {f['events'][0]['title']} on "
              f"{_day(f['events'][0]['starts_at'])}, and bring a neighbour.")
    elif f["hotspot_types"] and is_graffiti({"request_type": f["hotspot_types"][0][0]}):
        p3 = ("One way to help: organise a short neighbourhood walk this week to spot "
              "new tags and report them in Van311.")
    elif f["hotspot_types"]:
        p3 = (f"One way to help: pick one spot with {plain_words(f['hotspot_types'][0][0])} "
              "and organise a short neighbourhood walk to tidy it up and report anything new in Van311.")
    else:
        p3 = ("One way to help: take a short walk this week and report anything "
              "that needs fixing in Van311.")
    return "\n\n".join([_join_p1(p1), p2, p3])


def _join_p1(parts) -> str:
    # Sentences are joined with spaces; a list block sits on its own lines.
    out = parts[0]
    for prev, part in zip(parts, parts[1:]):
        sep = "\n" if ("\n- " in part or "\n- " in prev) else " "
        out += sep + part
    return out


def _prompt(area, f) -> str:
    lines = [f"Area: {area}"]
    if f["summary"]:
        lines.append(f"Area summary: {f['summary']}")
    if f["events"]:
        lines.append("Upcoming events (next 7 days):")
        lines += [f"- {_event_text(e)}" + (f" at {e['location']}" if e.get("location") else "")
                  for e in f["events"]]
    else:
        lines.append("Upcoming events (next 7 days): none")
    if f["issues"]:
        lines.append("City-only issues neighbours can vote on:")
        lines += [f"- {_issue_text(i)}" for i in f["issues"]]
    if f["hotspot_types"]:
        lines.append("Recurring 311 hotspots: " + _hotspot_text(f["hotspot_types"]))
    facts = "\n".join(lines)
    return (
        "You write the weekly 'ways to help' post for a neighbourhood forum.\n"
        f"Write a friendly plain-text post of at most {MAX_WORDS} words, using only the facts below.\n"
        "Rules: no Markdown, no HTML, no headings, no lists with symbols; do not invent any "
        "names, numbers, places or events; use Canadian spelling (neighbour, organise); "
        "for graffiti, suggest spotting and reporting it in Van311, never removing, cleaning or painting over it; "
        "end with one concrete way to help.\n\n"
        f"FACTS:\n{facts}\n"
    )


_TAG = re.compile(r"<\s*/?\s*[A-Za-z!]")
_HEADING = re.compile(r"^\s*#", re.M)


def _valid(text) -> str | None:
    if not isinstance(text, str):
        return None
    text = text.strip()
    if not text or len(text) > MAX_CHARS or _TAG.search(text) or _HEADING.search(text):
        return None
    return text


def build_briefing(area, summary_row, upcoming_events, top_track2, hotspots, today, llm=None) -> dict:
    week_of = today - timedelta(days=today.weekday())
    f = _facts(area, summary_row, upcoming_events, top_track2, hotspots, today)
    body, model = None, "template"
    if llm is not None:
        try:
            body = _valid(llm(_prompt(area, f)))
        except Exception:
            body = None
        if body is not None:
            model = getattr(llm, "model", "llm")
    if body is None:
        body = _template(area, f)
    return {
        "kind": "briefing",
        "author": AUTHOR,
        "local_area": area,
        "title": f"This week in {area}",
        "body": body,
        "week_of": week_of.isoformat(),
        "model": model,
        "dedupe_key": f"briefing:{area}:{week_of.isoformat()}",
    }
