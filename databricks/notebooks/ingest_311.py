# Databricks notebook source
# Incremental Vancouver 311 ingest: fetch records changed since the newest last_modified_timestamp in
# Postgres raw_311_requests and append them. First task of the bbb_daily job, so the pipeline that
# follows reads fresh data. Port of ingest311()/runDataset() in app/scripts/ingest.ts (which stays as is).
#
# Append only: raw_311_requests is never updated or deleted from. Progress is recorded in ingest_state;
# on failure the error is stored there and re-raised so the job stops before the pipeline runs.
# Postgres credentials come from the `bbb` secret scope (databricks/setup/setup_postgres.py).
#
# Driver: pg8000 (pure Python). psycopg[binary] aborts the Python process on Databricks serverless
# (SIGABRT while loading its bundled libpq/OpenSSL), so it can't be used here.
# TLS: the connection is encrypted, but the server's self-signed certificate isn't verified
# (the same protection as libpq's sslmode=require, which the rest of the project uses).
# Team decision, 2026-11-08.

# COMMAND ----------

# MAGIC %pip install "pg8000>=1.31" --quiet

# COMMAND ----------

import json
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import pg8000.native

API_ROOT = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets"
DATASET_311 = "3-1-1-service-requests"
PAGE_SIZE = 100
BATCH_SIZE = 2000
WINDOW = timedelta(hours=24)

# Column order matches the INSERT; each value is bound through an explicit cast so Postgres accepts
# the JSON strings/numbers the API returns.
COLUMNS = [
    ("department", "text"),
    ("service_request_type", "text"),
    ("status", "text"),
    ("closure_reason", "text"),
    ("service_request_open_timestamp", "timestamptz"),
    ("service_request_close_date", "date"),
    ("last_modified_timestamp", "timestamptz"),
    ("address", "text"),
    ("local_area", "text"),
    ("channel", "text"),
    ("latitude", "double precision"),
    ("longitude", "double precision"),
]


def secret(key):
    return dbutils.secrets.get("bbb", key)


def connect():
    if secret("pg_sslmode") == "disable":
        raise RuntimeError("pg_sslmode is 'disable'; ingest_311 only connects with TLS.")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False       # self-signed certificate: encrypt, don't verify (sslmode=require)
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=secret("pg_user"), password=secret("pg_password"), host=secret("pg_host"),
        port=int(secret("pg_port")), database=secret("pg_db"), ssl_context=ctx, timeout=30,
    )


def iso(dt):
    """Like JavaScript Date.toISOString(): 2026-11-07T04:56:25.000Z (UTC, milliseconds)."""
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def floor_ms(dt):
    return dt.replace(microsecond=dt.microsecond // 1000 * 1000)


def windows(since, end, step=WINDOW):
    """Yield (start, end) pairs of at most `step` covering since..end."""
    start = since
    while start < end:
        stop = min(start + step, end)
        yield start, stop
        start = stop


def where_clause(start, end):
    return f"last_modified_timestamp > date'{iso(start)}' and last_modified_timestamp <= date'{iso(end)}'"


def api_json(url, params=None, timeout=120, sleep=time.sleep):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    last_error = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"user-agent": "BlockByBlock-Ingest/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_error = e
            if attempt < 3:
                sleep(2 ** attempt)  # 1 s, 2 s, 4 s
    raise last_error


def record_page(dataset_id, offset, where=None, fetch=api_json):
    params = {"limit": PAGE_SIZE, "offset": offset, "order_by": "last_modified_timestamp"}
    if where:
        params["where"] = where
    return fetch(f"{API_ROOT}/{dataset_id}/records", params)


def all_records(dataset_id, where=None, fetch=api_json):
    output = []
    offset = 0
    while True:
        page = record_page(dataset_id, offset, where, fetch)
        output.extend(page["results"])
        if not page["results"] or len(output) >= page["total_count"]:
            return output
        offset += PAGE_SIZE


def source_processed_at(dataset_id, fetch=api_json):
    metadata = fetch(f"{API_ROOT}/{dataset_id}")
    return ((metadata.get("metas") or {}).get("default") or {}).get("data_processed")


def batches(records, size=BATCH_SIZE):
    for i in range(0, len(records), size):
        yield records[i:i + size]


def insert_sql_and_params(batch):
    """One multi-row INSERT for the batch, with pg8000.native :name parameters."""
    names = [name for name, _ in COLUMNS]
    rows, params = [], {}
    for i, record in enumerate(batch):
        cells = []
        for name, pg_type in COLUMNS:
            key = f"{name}_{i}"
            params[key] = record.get(name)
            cells.append(f"CAST(:{key} AS {pg_type})")
        rows.append("(" + ", ".join(cells) + ")")
    sql = f"INSERT INTO raw_311_requests ({', '.join(names)}) VALUES " + ", ".join(rows)
    return sql, params


def mark_started(conn, dataset_id):
    conn.run(
        "INSERT INTO ingest_state (dataset_id, last_started_at, last_error) VALUES (:d, now(), NULL) "
        "ON CONFLICT (dataset_id) DO UPDATE SET last_started_at = now(), last_error = NULL",
        d=dataset_id,
    )


def ingest_311(conn):
    rows = conn.run("SELECT max(last_modified_timestamp) FROM raw_311_requests")
    since = rows[0][0] if rows else None
    if since is None:
        raise RuntimeError("No 311 history loaded. Run npm --prefix app run ingest:history first.")
    since = floor_ms(since)

    loaded = 0
    end = floor_ms(datetime.now(timezone.utc))
    for start, stop in windows(since, end):
        records = all_records(DATASET_311, where_clause(start, stop))
        conn.run("START TRANSACTION")  # each window is all-or-nothing
        window_rows = 0
        for batch in batches(records):
            sql, params = insert_sql_and_params(batch)
            conn.run(sql, **params)
            window_rows += len(batch)
        conn.run("COMMIT")
        loaded += window_rows
        print(f"{DATASET_311}: {iso(start)}–{iso(stop)} ({len(records)}), total {loaded}")
    return loaded


# COMMAND ----------

conn = connect()
try:
    conn.run("SET TimeZone = 'UTC'")
    mark_started(conn, DATASET_311)
    try:
        loaded = ingest_311(conn)
        conn.run(
            "UPDATE ingest_state SET last_succeeded_at = now(), last_error = NULL, rows_loaded = :n, "
            "source_processed_at = CAST(:p AS timestamptz) WHERE dataset_id = :d",
            n=loaded, p=source_processed_at(DATASET_311), d=DATASET_311,
        )
        print(f"{DATASET_311}: loaded {loaded} rows")
    except Exception as e:
        try:
            conn.run("ROLLBACK")
        except Exception:
            pass
        conn.run("UPDATE ingest_state SET last_error = :m WHERE dataset_id = :d", m=str(e), d=DATASET_311)
        raise
finally:
    conn.close()

dbutils.notebook.exit(f"{DATASET_311}: loaded {loaded} rows")
