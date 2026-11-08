"""Block by Block 311 pipeline (Lakeflow Spark Declarative Pipelines).

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

RAW_COLS = [
    "id", "department", "service_request_type", "status", "closure_reason",
    "service_request_open_timestamp", "service_request_close_date", "last_modified_timestamp",
    "address", "local_area", "channel", "latitude", "longitude", "fetched_at",
]

# No natural key exists (see docs/data-shape.md); ~1% of rows collide and get merged in CURRENT.
KEY_COLS = ["department", "request_type", "opened_at", "address", "local_area", "channel", "latitude", "longitude"]


# ---------------------------------------------------------------- Bronze
@dp.table(name=BRONZE, comment="311 service requests as landed in Postgres (raw_311_requests)")
@dp.expect("has_postgres_id", "id IS NOT NULL")
def t311_raw():
    return spark.read.table(RAW_SOURCE).select(*RAW_COLS)


# ---------------------------------------------------------------- Silver
@dp.table(name=SILVER, comment="Cleaned, typed, H3-tagged 311 cases (every landed version)")
@dp.expect_or_drop("has_open_time", "opened_at IS NOT NULL")
@dp.expect("has_location", "latitude IS NOT NULL AND longitude IS NOT NULL")
# Only judged on geocoded rows; ungeocoded ones are already counted by has_location.
@dp.expect("in_vancouver", "latitude IS NULL OR (latitude BETWEEN 49.19 AND 49.32 AND longitude BETWEEN -123.27 AND -123.02)")
def t311_cases():
    df = spark.read.table(BRONZE).select(
        "id",
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
    )
    key = F.sha2(F.concat_ws("|", *[F.coalesce(F.col(c).cast("string"), F.lit("")) for c in KEY_COLS]), 256)
    return df.withColumn("case_key", key).withColumn(
        "h3_r9", F.expr("h3_longlatash3string(longitude, latitude, 9)")
    )


@dp.table(name=CURRENT, comment="One row per case_key: the latest version (ties broken by Postgres id)")
def t311_cases_current():
    w = Window.partitionBy("case_key").orderBy(F.col("modified_at").desc_nulls_last(), F.col("id").desc())
    return (
        spark.read.table(SILVER)
        .withColumn("_rn", F.row_number().over(w))
        .filter("_rn = 1")
        .drop("_rn")
    )
