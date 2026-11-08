"""Read-only integration check: run the real impact SELECT against synthetic CTEs.

Run with an authenticated databricks CLI on PATH:
    python databricks/tests/check_event_impact.py
No application events or tables are created or modified.
"""
import json
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


def cli(*args):
    result = subprocess.run(["databricks", *args, "-o", "json"],
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def statement():
    rankings = (Path(__file__).resolve().parents[1] / "sql" / "rankings.sql").read_text()
    impact = rankings.split("CREATE OR REPLACE TABLE bbb.gold.event_impact", 1)[1]
    query = impact.partition("\nAS ")[2].strip().rstrip(";")
    assert query.startswith("SELECT ")
    query = query.replace("bbb_app.public.events", "sample_events")
    query = query.replace("bbb.gold.cases_enriched", "sample_cases")
    done = datetime(2026, 11, 7, tzinfo=timezone.utc)
    offsets = [
        ("outside-before", -timedelta(days=60, seconds=1)),
        ("start-before", -timedelta(days=60)),
        ("just-before", -timedelta(seconds=1)),
        ("at-done", timedelta(0)),
        ("end-after", timedelta(days=60) - timedelta(seconds=1)),
        ("outside-after", timedelta(days=60)),
    ]
    local = ZoneInfo("America/Vancouver")
    cases, events = [], []
    for name, offset in offsets:
        opened = (done + offset).astimezone(local).strftime("%Y-%m-%d %H:%M:%S")
        cases.append(f"('{name}', '8928308280fffff', TIMESTAMP '{opened}')")
        events.append(f"('{name}', '8928308280fffff', '{name}', TIMESTAMP '2026-11-07 00:00:00')")
    events.append("('no-reports', '8928308280fffff', 'Other', TIMESTAMP '2026-11-07 00:00:00')")
    return ("WITH sample_events(id, h3_r9, category, done_at) AS (VALUES\n"
            + ",\n".join(events) + "),\nsample_cases(category, h3_r9, opened_at) AS (VALUES\n"
            + ",\n".join(cases) + ")\n" + query)


def main():
    body = {"warehouse_id": "2f68997ea797ec69", "statement": statement(),
            "wait_timeout": "10s", "on_wait_timeout": "CONTINUE"}
    result = cli("api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body))
    deadline = time.monotonic() + 300
    while result["status"]["state"] in ("PENDING", "RUNNING"):
        if time.monotonic() > deadline:
            raise TimeoutError("Impact SQL check exceeded five minutes")
        time.sleep(3)
        result = cli("api", "get", "/api/2.0/sql/statements/" + result["statement_id"])
    if result["status"]["state"] != "SUCCEEDED":
        raise RuntimeError(result["status"])
    rows = result["result"]["data_array"]
    actual = {r[0]: (int(r[4]), int(r[5])) for r in rows}
    assert actual == {
        "outside-before": (0, 0), "start-before": (1, 0), "just-before": (1, 0),
        "at-done": (0, 1), "end-after": (0, 1), "outside-after": (0, 0),
        "no-reports": (0, 0),
    }, actual
    print("PASS: before/after boundaries, Vancouver-to-UTC conversion, and zero-report event")


if __name__ == "__main__":
    main()
