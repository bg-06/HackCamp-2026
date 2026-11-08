"""GreenHands BC 311 pipeline (Lakeflow Spark Declarative Pipelines).

All input lands in our Postgres (see plan.md 3.1); Databricks reads it through the Lakehouse
Federation foreign catalog `bbb_app` (created by databricks/setup/setup_postgres.py).

Bronze: bbb.bronze.t311_raw            copy of bbb_app.public.raw_311_requests (append-only, every version)
Silver: bbb.silver.t311_cases          cleaned, typed, H3-tagged, one row per landed version
        bbb.silver.t311_cases_current  latest version of each case_key (window function)
Gold:   databricks/sql/gold_views.sql

Postgres can't be streamed from, so these are materialized views (batch). Each run re-reads the
~1.3M rows from Postgres, about a minute at this size.

The source table can be overridden with the pipeline setting `bbb.raw_311_source`.
"""
try:
    from pyspark import pipelines as dp
except ImportError:  # older runtimes
    import dlt as dp

from pyspark.sql import Window
from pyspark.sql import functions as F

RAW_SOURCE = spark.conf.get("bbb.raw_311_source", "bbb_app.public.raw_311_requests")
BRONZE = "bbb.bronze.t311_raw"
SILVER = "bbb.silver.t311_cases"
CURRENT = "bbb.silver.t311_cases_current"

CITY_COLS = [
    "department", "service_request_type", "status", "closure_reason",
    "service_request_open_timestamp", "service_request_close_date", "last_modified_timestamp",
    "address", "local_area", "channel", "latitude", "longitude",
]
# Identity fields for a case (no public case ID exists). Same fields as the TS ingest's source_hash.
IDENTITY_COLS = [
    "department", "service_request_type", "service_request_open_timestamp",
    "address", "local_area", "channel", "latitude", "longitude",
]


def _first(cols, *names):
    return next((n for n in names if n in cols), None)


# ---------------------------------------------------------------- Bronze
# raw_311_requests has had two layouts: (id, fetched_at) from plan.md 5.2, and
# (ingest_id, source_hash, ingested_at) from app/db/migrations/001_ingest.sql. Accept either and
# normalise to (id, source_hash, <City fields>, loaded_at). geom / source_record are never read:
# lat/lon carry the same data.
@dp.table(name=BRONZE, comment="311 service requests as landed in Postgres (raw_311_requests)")
@dp.expect("has_postgres_id", "id IS NOT NULL")
def t311_raw():
    src = spark.read.table(RAW_SOURCE)
    cols = set(src.columns)
    id_col = _first(cols, "ingest_id", "id")
    loaded_col = _first(cols, "ingested_at", "fetched_at")
    if "source_hash" in cols:
        source_hash = F.col("source_hash")
    else:
        source_hash = F.sha2(F.concat_ws("|", *[F.coalesce(F.col(c).cast("string"), F.lit("")) for c in IDENTITY_COLS]), 256)
    return src.select(
        F.col(id_col).cast("bigint").alias("id"),
        source_hash.alias("source_hash"),
        *CITY_COLS,
        (F.col(loaded_col) if loaded_col else F.lit(None).cast("timestamp")).alias("loaded_at"),
    )


# ---------------------------------------------------------------- Silver
@dp.table(name=SILVER, comment="Cleaned, typed, H3-tagged 311 cases (every landed version)")
@dp.expect_or_drop("has_open_time", "opened_at IS NOT NULL")
@dp.expect("has_location", "latitude IS NOT NULL AND longitude IS NOT NULL")
# Only judged on geocoded rows; ungeocoded ones are already counted by has_location.
@dp.expect("in_vancouver", "latitude IS NULL OR (latitude BETWEEN 49.19 AND 49.32 AND longitude BETWEEN -123.27 AND -123.02)")
def t311_cases():
    # case_key = source_hash (sha256 of the identity fields). ~1% of rows collide and merge in CURRENT.
    return spark.read.table(BRONZE).select(
        "id",
        F.col("source_hash").alias("case_key"),
        "department",
        F.col("service_request_type").alias("request_type"),
        "status",
        "closure_reason",
        # Stored as Vancouver local time so it lines up with closed_on (a local date).
        F.from_utc_timestamp("service_request_open_timestamp", "America/Vancouver").alias("opened_at"),
        F.col("service_request_close_date").alias("closed_on"),
        F.col("last_modified_timestamp").alias("modified_at"),
        "address",
        "local_area",
        "channel",
        F.col("latitude").cast("double").alias("latitude"),
        F.col("longitude").cast("double").alias("longitude"),
        F.expr("h3_longlatash3string(longitude, latitude, 9)").alias("h3_r9"),
    )


@dp.table(name=CURRENT, comment="One row per case_key: the latest version (ties broken by Postgres ingest_id)")
def t311_cases_current():
    w = Window.partitionBy("case_key").orderBy(F.col("modified_at").desc_nulls_last(), F.col("id").desc())
    return (
        spark.read.table(SILVER)
        .withColumn("_rn", F.row_number().over(w))
        .filter("_rn = 1")
        .drop("_rn")
    )
