"""Shared Vancouver-local date helpers."""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo("America/Vancouver")


def as_date(value) -> date:
    """Local (Vancouver) calendar date; naive datetimes are already local."""
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(LOCAL_TZ)
        return value.date()
    return value
