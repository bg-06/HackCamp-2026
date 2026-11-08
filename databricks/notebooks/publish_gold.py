# Databricks notebook source
# Copy the small gold tables the app needs from bbb.gold into Postgres gold_* tables.
# Lakehouse Federation is read-only, so this is the way back out (plan.md 5.7).
#
# Each table is swapped in one transaction (TRUNCATE + COPY), so the app never sees a half-written
# table. Postgres credentials come from the `bbb` secret scope (databricks/setup/setup_postgres.py).
#
# Driver: pg8000 (pure Python). psycopg[binary] aborts the Python process on Databricks serverless
# (SIGABRT while loading its bundled libpq/OpenSSL), so it can't be used here.
# TLS: the connection is encrypted, but the server's self-signed certificate isn't verified
# (the same protection as libpq's sslmode=require, which the rest of the project uses).
# Team decision, 2026-11-08.

# COMMAND ----------

# MAGIC %pip install "pg8000>=1.31" --quiet

# COMMAND ----------

import csv
import io
import re
import ssl

import pg8000.native

spark.conf.set("spark.sql.session.timeZone", "UTC")  # naive datetimes below are UTC / local as noted in DDL

# Postgres table -> query. Tables are owned by app/db/migrations/003_gold_tables.sql.
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
    return all(spark.catalog.tableExists(t) for t in re.findall(r"FROM\s+(bbb\.gold\.\w+)", query))


def validate_targets(conn):
    """Check every destination before publishing; migrations own schema creation."""
    missing = [
        table for table in [*TABLES, "gold_published"]
        if conn.run("SELECT to_regclass(:table)", table=table)[0][0] is None
    ]
    if missing:
        raise RuntimeError(
            "Missing Postgres publish tables: " + ", ".join(missing)
            + ". Apply app/db/migrations with npm --prefix app run db:migrate before publishing."
        )


def to_csv(rows):
    """Rows -> CSV for COPY ... WITH (FORMAT csv). None becomes an unquoted empty field (NULL);
    every other value is quoted, so an empty string stays an empty string."""
    buf = io.StringIO()
    csv.writer(buf, quoting=csv.QUOTE_NOTNULL, lineterminator="\n").writerows(rows)
    buf.seek(0)
    return buf


def connect():
    if secret("pg_sslmode") == "disable":
        raise RuntimeError("pg_sslmode is 'disable'; publish_gold only connects with TLS.")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False       # self-signed certificate: encrypt, don't verify (sslmode=require)
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=secret("pg_user"), password=secret("pg_password"), host=secret("pg_host"),
        port=int(secret("pg_port")), database=secret("pg_db"), ssl_context=ctx, timeout=30,
    )


# COMMAND ----------

conn = connect()
published, skipped = {}, {}
try:
    conn.run("SET TimeZone = 'UTC'")

    validate_targets(conn)

    for table, query in TABLES.items():
        if not source_exists(query):
            skipped[table] = "source not built yet"
            continue
        df = spark.sql(query)
        rows = [tuple(r) for r in df.collect()]  # all small: a few thousand rows at most
        if not rows and table not in ALLOW_EMPTY:
            skipped[table] = "0 rows from Databricks; kept the old Postgres copy"
            continue
        conn.run("BEGIN")
        try:
            conn.run(f"TRUNCATE {table}")
            conn.run(f"COPY {table} ({', '.join(df.columns)}) FROM STDIN WITH (FORMAT csv)", stream=to_csv(rows))
            conn.run(
                "INSERT INTO gold_published (table_name, row_count, published_at) VALUES (:t, :n, now()) "
                "ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count, published_at = now()",
                t=table, n=len(rows),
            )
            conn.run("COMMIT")
        except Exception:
            conn.run("ROLLBACK")
            raise
        published[table] = len(rows)
finally:
    conn.close()

print("published:", published)
print("skipped:", skipped)
dbutils.jobs.taskValues.set("published", published)
