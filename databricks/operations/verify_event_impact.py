"""Read-only verification of app event -> fast job -> published impact.

No arguments lists recent completed events. --event-id verifies one using the latest
successful fast-job run. --run-id can select a specific run instead.
Requires an authenticated databricks CLI on PATH. Never starts jobs or writes data.
"""
import argparse
import json
import subprocess
import time

WAREHOUSE_ID = "2f68997ea797ec69"
FAST_JOB_ID = 427293815798960


def cli(*args):
    response = subprocess.run(["databricks", *args, "-o", "json"],
                              capture_output=True, text=True, encoding="utf-8")
    if response.returncode:
        raise RuntimeError(f"Databricks {args[0]} {args[1]} failed: {response.stderr.strip()}")
    return json.loads(response.stdout or "{}")


def select(statement, parameters=None):
    body = {"warehouse_id": WAREHOUSE_ID, "statement": statement,
            "parameters": parameters or [], "wait_timeout": "10s", "on_wait_timeout": "CONTINUE"}
    response = cli("api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body))
    deadline = time.monotonic() + 300
    while response["status"]["state"] in ("PENDING", "RUNNING"):
        if time.monotonic() >= deadline:
            raise TimeoutError("Read-only verification exceeded five minutes")
        time.sleep(3)
        response = cli("api", "get", "/api/2.0/sql/statements/" + response["statement_id"])
    if response["status"]["state"] != "SUCCEEDED":
        raise RuntimeError(response["status"].get("error", response["status"]))
    columns = [c["name"] for c in response["manifest"]["schema"]["columns"]]
    return [dict(zip(columns, row)) for row in response.get("result", {}).get("data_array", [])]


def check_run(run):
    if run.get("job_id") != FAST_JOB_ID:
        raise ValueError(f"Run belongs to a different job, expected {FAST_JOB_ID}")
    if run.get("state", {}).get("result_state") != "SUCCESS":
        raise ValueError("Fast job has not succeeded: " + str(run.get("state", {})))
    tasks = {task["task_key"]: task for task in run.get("tasks", [])}
    for key in ("refresh_rankings", "publish_gold"):
        if tasks.get(key, {}).get("state", {}).get("result_state") != "SUCCESS":
            raise ValueError(f"Task {key} did not succeed")
    started, ended = int(run["start_time"]), int(run["end_time"])
    if not 0 < started <= ended:
        raise ValueError("Successful run has no valid start/end window")
    return started, ended


def latest_successful_run():
    response = cli("api", "get", f"/api/2.2/jobs/runs/list?job_id={FAST_JOB_ID}&completed_only=true&limit=10")
    for run in response.get("runs", []):
        if run.get("state", {}).get("result_state") == "SUCCESS":
            return cli("jobs", "get-run", str(run["run_id"]))
    raise ValueError("No successful fast-job run among the last ten completed runs")


def verification_query():
    return """
WITH selected_event AS (
  SELECT id, h3_r9, category, done_at FROM bbb_app.public.events WHERE id = :event_id
), expected AS (
  SELECT e.id,
    count_if(to_utc_timestamp(c.opened_at, 'America/Vancouver') >= e.done_at - INTERVAL 60 DAYS
             AND to_utc_timestamp(c.opened_at, 'America/Vancouver') < e.done_at) AS before_count,
    count_if(to_utc_timestamp(c.opened_at, 'America/Vancouver') >= e.done_at
             AND to_utc_timestamp(c.opened_at, 'America/Vancouver') < e.done_at + INTERVAL 60 DAYS) AS after_count
  FROM selected_event e LEFT JOIN bbb.gold.cases_enriched c
    ON c.category = e.category AND array_contains(
      CASE WHEN h3_isvalid(e.h3_r9) THEN h3_kring(e.h3_r9, 1) ELSE array() END, c.h3_r9)
  GROUP BY e.id
)
SELECT e.id AS event_id, cast(e.done_at AS STRING) AS done_at, e.category,
       CASE WHEN h3_isvalid(e.h3_r9) THEN h3_resolution(e.h3_r9) = 9 ELSE false END AS valid_h3,
       x.before_count AS expected_before, x.after_count AS expected_after,
       d.event_id AS delta_event_id, d.reports_60d_before AS delta_before, d.reports_60d_after AS delta_after,
       g.event_id AS postgres_event_id, g.reports_60d_before AS postgres_before, g.reports_60d_after AS postgres_after,
       d.h3_r9 = e.h3_r9 AND d.category = e.category AND d.done_at = e.done_at AS delta_event_matches,
       g.h3_r9 = e.h3_r9 AND g.category = e.category AND g.done_at = e.done_at AS postgres_event_matches,
       cast(p.published_at AS STRING) AS published_at,
       timestamp_millis(:run_start_ms) >= e.done_at AS run_after_completion,
       p.published_at >= e.done_at AND p.published_at >= timestamp_millis(:run_start_ms)
         AND p.published_at <= timestamp_millis(:run_end_ms) AS fresh
FROM selected_event e JOIN expected x ON x.id = e.id
LEFT JOIN bbb.gold.event_impact d ON d.event_id = e.id
LEFT JOIN bbb_app.public.gold_event_impact g ON g.event_id = e.id
LEFT JOIN bbb_app.public.gold_published p ON p.table_name = 'gold_event_impact'
"""


def is_true(value):
    return value is True or value == "true"


def assess(row):
    errors = []
    if not row.get("done_at"):
        errors.append("App event has not been completed")
    if not row.get("category") or not is_true(row.get("valid_h3")):
        errors.append("App event needs a category and valid resolution-9 H3 cell")
    if not is_true(row.get("run_after_completion")):
        errors.append("Selected run started before event completion")
    for location in ("delta", "postgres"):
        if not row.get(location + "_event_id"):
            errors.append(f"Event is missing from {location} impact")
            continue
        if not is_true(row.get(location + "_event_matches")):
            errors.append(f"{location} impact uses different event inputs")
        for side in ("before", "after"):
            actual, expected = row.get(f"{location}_{side}"), row.get(f"expected_{side}")
            if actual is None or expected is None or int(actual) != int(expected):
                errors.append(f"{location} {side} count differs from recomputed count")
    if not is_true(row.get("fresh")):
        errors.append("Postgres impact publication is not fresh within the selected run")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event-id")
    parser.add_argument("--run-id", type=int, help="Optional specific fast-job run; otherwise use latest success")
    args = parser.parse_args()
    if not args.event_id:
        if args.run_id:
            parser.error("--run-id requires --event-id")
        rows = select("""SELECT id, category, cast(done_at AS STRING) AS done_at
                         FROM bbb_app.public.events WHERE done_at IS NOT NULL
                         ORDER BY done_at DESC LIMIT 10""")
        print(json.dumps({"completed_events": rows}, indent=2))
        if not rows:
            print("WAITING: no completed app events. The app must save done_at through POST /events/:id/done first.")
            return 2
        print("Choose --event-id to verify the latest successful scheduled refresh, or specify --run-id.")
        return 0
    run = cli("jobs", "get-run", str(args.run_id)) if args.run_id else latest_successful_run()
    started, ended = check_run(run)
    rows = select(verification_query(), [
        {"name": "event_id", "value": args.event_id, "type": "STRING"},
        {"name": "run_start_ms", "value": str(started), "type": "BIGINT"},
        {"name": "run_end_ms", "value": str(ended), "type": "BIGINT"},
    ])
    if len(rows) != 1:
        raise ValueError("Expected one existing app event, found " + str(len(rows)))
    errors = assess(rows[0])
    print(json.dumps({"run_id": run.get("run_id", args.run_id), "event": rows[0], "errors": errors}, indent=2))
    print("FAIL" if errors else "PASS: job succeeded and fresh impact counts match through Postgres")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
