"""Suggestion engine: pure logic, no I/O.

Inputs (plain dicts, e.g. rows from psycopg with dict_row):
  hotspots: h3_r9, request_type, category, local_area, times_reported,
            months_seen, last_reported (datetime)
  events:   h3_r9, latitude, longitude, local_area, category (all may be None),
            done_at (None if not done), starts_at (datetime)
  orgs:     id, name, latitude, longitude (may be None)
  today:    datetime.date

suggest() returns a list of suggestion payloads (see agent/README.md contract)
for recurring hotspots with no event in [today, today + window_days]. An event
covers a hotspot by cell (h3_r9, else its latitude/longitude) or, when it has no
cell and no coordinates, by the same local_area and category.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime

import h3

from .timeutil import LOCAL_TZ, as_date as _as_date
from .programs import CLEANUP_LINE, is_graffiti, program_for
from .wording import is_plural, plain_words

AUTHOR = "block-steward-agent"
MAX_ORG_KM = 2.0
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(a))


def _event_cell(e):
    """Cell of an event: h3_r9 if set, else from latitude/longitude, else None."""
    if e.get("h3_r9"):
        return e["h3_r9"]
    lat, lng = e.get("latitude"), e.get("longitude")
    if lat is not None and lng is not None:
        return h3.latlng_to_cell(float(lat), float(lng), 9)
    return None


def _coverage(events, today, window_days):
    """Return (covered cells, covered (local_area, category) pairs)."""
    cells, pairs = set(), set()
    for e in events:
        if e.get("done_at") is not None or e.get("starts_at") is None:
            continue
        offset = (_as_date(e["starts_at"]) - today).days
        if not 0 <= offset <= window_days:
            continue
        cell = _event_cell(e)
        if cell is not None:
            cells.add(cell)
        elif e.get("local_area") and e.get("category"):
            pairs.add((e["local_area"], e["category"]))
    return cells, pairs


def _nearest_org_ids(lat, lng, orgs, max_orgs) -> list:
    found = []
    for o in orgs:
        if o.get("latitude") is None or o.get("longitude") is None:
            continue
        d = _haversine_km(lat, lng, float(o["latitude"]), float(o["longitude"]))
        if d <= MAX_ORG_KM:
            found.append((d, o["id"]))
    found.sort(key=lambda t: t[0])
    return [oid for _, oid in found[:max_orgs]]


def _short_date(value) -> str:
    d = _as_date(value)
    return f"{_MONTHS[d.month - 1]} {d.day}"


def _count(n: int, unit: str) -> str:
    return f"{n} {unit}" if n == 1 else f"{n} {unit}s"


def _body(h: dict, program) -> str:
    what = plain_words(h["request_type"])
    sentences = [
        f"{what[0].upper() + what[1:]} {'have' if is_plural(h['request_type']) else 'has'} "
        f"been reported {_count(h['times_reported'], 'time')} over "
        f"{_count(h['months_seen'], 'month')} "
        f"in this part of {h['local_area']}, most recently on "
        f"{_short_date(h['last_reported'])}.",
        "No neighbour event is planned at this spot in the next two weeks.",
    ]
    if is_graffiti(h):
        sentences.append(
            "Neighbours can report new tags in Van311 and organise a walk "
            "to spot and report them.")
    else:
        sentences.append("A small neighbourhood cleanup could make a difference.")
    if program:
        sentences.append(CLEANUP_LINE)
    return " ".join(sentences)


def _iso_week(d: date) -> str:
    year, week, _ = d.isocalendar()
    return f"{year}-W{week:02d}"


def _local_iso(value):
    """ISO string with the Vancouver offset (naive values are local already)."""
    if not isinstance(value, datetime):
        return value.isoformat() if hasattr(value, "isoformat") else value
    value = (value.replace(tzinfo=LOCAL_TZ) if value.tzinfo is None
             else value.astimezone(LOCAL_TZ))
    return value.isoformat()


def _payload(h: dict, today: date, orgs, max_orgs) -> dict:
    lat, lng = h3.cell_to_latlng(h["h3_r9"])
    graffiti = is_graffiti(h)
    program = program_for(h)
    area = h["local_area"]
    what = plain_words(h["request_type"])
    return {
        "kind": "suggestion",
        "author": AUTHOR,
        "local_area": area,
        "org_ids": _nearest_org_ids(lat, lng, orgs, max_orgs),
        "title": (f"Organise a graffiti walk in {area}?" if graffiti
                  else f"Host a cleanup for {what} in {area}?"),
        "body": _body(h, program),
        "hotspot": {
            "h3_r9": h["h3_r9"],
            "request_type": h["request_type"],
            "category": h["category"],
            "times_reported": h["times_reported"],
            "months_seen": h["months_seen"],
            "last_reported": _local_iso(h["last_reported"]),
        },
        "event_draft": {
            "kind": "hotspot",
            "title": (f"Graffiti walk in {area}" if graffiti
                      else f"Cleanup: {what} in {area}"),
            "category": h["category"],
            "local_area": area,
            "latitude": lat,
            "longitude": lng,
            "hotspot_id": f"{h['h3_r9']}|{h['request_type']}",
            "what_to_bring": ("Gloves and a phone to report new tags in Van311"
                              if graffiti else "Gloves, grabbers and bags"),
            "signup_url": None,
        },
        "city_program": program,
        "dedupe_key": f"suggestion:{h['h3_r9']}:{h['request_type']}:{_iso_week(today)}",
    }


def suggest(hotspots, events, orgs, today, *, window_days=14, max_per_area=3,
            max_orgs=3, areas=None) -> list[dict]:
    covered, covered_pairs = _coverage(events, today, window_days)
    wanted = set(areas) if areas else None
    by_area = defaultdict(list)
    for h in hotspots:
        area = h.get("local_area")
        if not area or h["h3_r9"] in covered or (area, h.get("category")) in covered_pairs:
            continue
        if wanted is not None and area not in wanted:
            continue
        by_area[area].append(h)

    out = []
    for area in sorted(by_area):
        ranked = sorted(
            by_area[area],
            key=lambda h: (-h["times_reported"], -h["months_seen"],
                           -h["last_reported"].timestamp()),
        )
        out.extend(_payload(h, today, orgs, max_orgs) for h in ranked[:max_per_area])
    return out
