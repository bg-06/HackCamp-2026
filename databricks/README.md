# Databricks operations

The daily job reads incremental City 311 changes into Postgres, refreshes the batch
bronze/silver/gold pipeline, freezes new AI labels, refreshes rankings and event impact,
generates summaries when due, and publishes the six app-facing gold datasets to Postgres.

## Before publishing

The app/ingest owner applies `app/db/migrations/` with `npm --prefix app run db:migrate`.
This is a shared-database write. The publisher does not create tables: it checks all
six destinations plus `gold_published` before replacing any data, and reports missing
tables with migration instructions. `postgres/gold_tables.sql` is a historical schema
reference; `app/db/migrations/003_gold_tables.sql` owns the table definitions.

Credentials stay in the `bbb` Databricks secret scope. Never print the local env file
or secret values. The notebooks currently encrypt TLS without certificate verification;
coordinate a trusted CA change with the database owner.

## Deployment and verification

From `databricks/`, using an authenticated CLI:

```text
databricks bundle validate
databricks bundle deploy
databricks bundle run bbb_daily
```

Deployment updates the existing resources. Confirm the remote daily job includes
`ingest_311` and that `pipeline_refresh` depends on it. The existing daily job ID is
`239098840352887`; the fast rankings/publish job ID is `427293815798960`.

A successful run must also have fresh `gold_published` timestamps, matching source,
target and metadata row counts, and no unexpected skipped publishes. Zero new ingest
rows can be valid when the City has no newer modifications. Zero event-impact rows
can be valid before any events have been completed.

The schedule is 06:00 `America/Vancouver`. The current development target pauses
schedules on deployment. After verifying a run, explicitly unpause the existing job
using the command in `databricks.yml`, then read the job settings back. Repeat this
after each development deployment. Use the named timezone rather than a fixed UTC hour.

Avoid running the TypeScript and Databricks 311 ingesters concurrently. The daily
job's concurrency limit protects that job, not other writers.

## Event-impact contract and checks

The app supplies `events.id`, a valid resolution-9 string `h3_r9`, a matching category,
and a timezone-aware `done_at`. Cases store Vancouver-local `opened_at`; rankings
convert those values to UTC before comparing them with event completion instants.
Reports are counted within the event cell and its one-cell ring, using half-open
60-day windows: `[done_at - 60 days, done_at)` and `[done_at, done_at + 60 days)`.

From the repo root, with the Python test dependencies installed:

```text
python -m pytest -q databricks/tests
python databricks/tests/check_event_impact.py
```

The first command tests publisher preflight with fake database responses. The second
uses the authenticated CLI and SQL warehouse to run the actual impact SELECT over
synthetic CTEs; it creates no tables or app events. It checks each boundary separately,
timezone conversion, and events without matching reports. The warehouse may start.

After the app has a real completion path, verify its n8n trigger starts the fast job
and that the event's impact row reaches Postgres. Synthetic SQL checks do not establish
that the app/webhook integration works or that an event caused a reduction in reports.

## Demo assets

See `dashboards/README.md` for the six-chart AI/BI dashboard and
`genie/instructions.md` for the eight Genie questions. Both are already created;
check teammate access and query results before recording the demo.
