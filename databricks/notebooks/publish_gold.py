# Databricks notebook source
# Copy the small gold tables the app needs from bbb.gold into Postgres gold_* tables.
# Lakehouse Federation is read-only, so this is the way back out (plan.md 5.7).
#
# Each table is swapped in one transaction (TRUNCATE + COPY), so the app never sees a half-written
# table. Postgres credentials come from the `bbb` secret scope (databricks/setup/setup_postgres.py).

# COMMAND ----------

# MAGIC %pip install "psycopg[binary]>=3.2" --quiet

# COMMAND ----------

import pathlib

import psycopg

spark.conf.set("spark.sql.session.timeZone", "UTC")  # naive datetimes below are UTC / local as noted in DDL

# Postgres table -> query. Column order must match databricks/postgres/gold_tables.sql.
TABLES = {
    "gold_type_categories": """
        SELECT t.request_type, t.category, coalesce(o.track, t.ai_track) AS track
        FROM bbb.gold.type_categories t
        LEFT JOIN (SELECT request_type, max(track) AS track FROM bbb.gold.track_overrides GROUP BY request_type) o
          USING (request_type)""",
    "gold_hotspots_h3": "SELECT h3_r9, track, category, open_count FROM bbb.gold.hotspots_h3",
    "gold_help_hotspots": """
        SELECT h3_r9, request_type, category, local_area, times_reported, months_seen, last_reported
        FROM bbb.gold.help_hotspots""",
    "gold_track2_issues": """
        SELECT issue_id, h3_r9, request_type, category, local_area, address, open_cases, days_open,
               times_reported_12m, CAST(base_score AS DOUBLE) AS base_score
        FROM bbb.gold.track2_issues""",
    "gold_event_impact": """
        SELECT event_id, h3_r9, category, done_at, reports_60d_before, reports_60d_after, days_since_done
        FROM bbb.gold.event_impact""",
    "gold_area_summaries": "SELECT local_area, generated_on, summary FROM bbb.gold.area_summaries",
}
# These may legitimately be empty (no finished events yet); the rest being empty means something broke.
ALLOW_EMPTY = {"gold_event_impact"}


def secret(key):
    return dbutils.secrets.get("bbb", key)


def source_exists(query):
    import re
    return all(spark.catalog.tableExists(t) for t in re.findall(r"FROM\s+(bbb\.gold\.\w+)", query))


DDL = (pathlib.Path.cwd().parent / "postgres" / "gold_tables.sql").read_text()

conn = psycopg.connect(
    host=secret("pg_host"), port=secret("pg_port"), dbname=secret("pg_db"),
    user=secret("pg_user"), password=secret("pg_password"), sslmode=secret("pg_sslmode"),
    connect_timeout=20, options="-c TimeZone=UTC",
)

published, skipped = {}, {}
with conn:
    with conn.transaction():
        conn.execute(DDL)

    for table, query in TABLES.items():
        if not source_exists(query):
            skipped[table] = "source not built yet"
            continue
        df = spark.sql(query)
        rows = df.collect()  # all small: a few thousand rows at most
        if not rows and table not in ALLOW_EMPTY:
            skipped[table] = "0 rows from Databricks; kept the old Postgres copy"
            continue
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(f"TRUNCATE {table}")
            with cur.copy(f"COPY {table} ({', '.join(df.columns)}) FROM STDIN") as copy:
                for r in rows:
                    copy.write_row(tuple(r))
            cur.execute(
                "INSERT INTO gold_published (table_name, row_count, published_at) VALUES (%s, %s, now()) "
                "ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count, published_at = now()",
                (table, len(rows)),
            )
        published[table] = len(rows)

print("published:", published)
print("skipped:", skipped)
dbutils.jobs.taskValues.set("published", published)
