"""Block by Block 311 pipeline (Lakeflow Spark Declarative Pipelines).

Bronze: one streaming table fed by two Auto Loader flows
  - 311_full/  one-time full parquet export (typed)
  - 311/       daily JSON batches written by notebooks/fetch_311.py (strings)
Both are normalised to the same typed schema; `geom` is dropped (duplicate of lat/lon).

Silver: t311_cases (append-only, every version) -> t311_cases_current (CDC, latest per case_key).
"""
try:
    from pyspark import pipelines as dp
except ImportError:  # older runtimes
    import dlt as dp

from pyspark.sql import functions as F

LANDING = "/Volumes/bbb/raw/landing"
BRONZE = "bbb.bronze.t311_raw"

# Explicit schema so the JSON flow works on an empty folder (no inference needed).
JSON_SCHEMA = """
    department STRING, service_request_type STRING, status STRING, closure_reason STRING,
    service_request_open_timestamp STRING, service_request_close_date STRING,
    last_modified_timestamp STRING, address STRING, local_area STRING, channel STRING,
    latitude DOUBLE, longitude DOUBLE
"""


def _normalise(df):
    return df.select(
        "department",
        "service_request_type",
        "status",
        "closure_reason",
        F.to_timestamp("service_request_open_timestamp").alias("service_request_open_timestamp"),
        F.to_date("service_request_close_date").alias("service_request_close_date"),
        F.to_timestamp("last_modified_timestamp").alias("last_modified_timestamp"),
        "address",
        "local_area",
        "channel",
        F.col("latitude").cast("double").alias("latitude"),
        F.col("longitude").cast("double").alias("longitude"),
        F.current_timestamp().alias("_ingested_at"),
        F.col("_metadata.file_path").alias("_source_file"),
    )


dp.create_streaming_table(
    name=BRONZE,
    comment="Raw 311 service requests from the City of Vancouver open data portal",
)


@dp.append_flow(target=BRONZE, name="bronze_full_parquet")
def bronze_full_parquet():
    return _normalise(
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .load(f"{LANDING}/311_full/")
    )


@dp.append_flow(target=BRONZE, name="bronze_daily_json")
def bronze_daily_json():
    return _normalise(
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .schema(JSON_SCHEMA)
        .load(f"{LANDING}/311/")
    )


# ---------------------------------------------------------------- Silver
SILVER = "bbb.silver.t311_cases"
CURRENT = "bbb.silver.t311_cases_current"

# No natural key exists (see docs/data-shape.md); ~1% of rows collide and get merged by CDC.
KEY_COLS = ["department", "request_type", "opened_at", "address", "local_area", "channel", "latitude", "longitude"]


@dp.table(name=SILVER, comment="Cleaned, typed, H3-tagged 311 cases (append-only, every version)")
@dp.expect_or_drop("has_open_time", "opened_at IS NOT NULL")
@dp.expect("has_location", "latitude IS NOT NULL AND longitude IS NOT NULL")
# Only judged on geocoded rows; ungeocoded ones are already counted by has_location.
@dp.expect("in_vancouver", "latitude IS NULL OR (latitude BETWEEN 49.19 AND 49.32 AND longitude BETWEEN -123.27 AND -123.02)")
def t311_cases():
    df = spark.readStream.table(BRONZE).select(
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
        "latitude",
        "longitude",
    )
    key = F.sha2(F.concat_ws("|", *[F.coalesce(F.col(c).cast("string"), F.lit("")) for c in KEY_COLS]), 256)
    return df.withColumn("case_key", key).withColumn(
        "h3_r9", F.expr("h3_longlatash3string(longitude, latitude, 9)")
    )


# Latest version of each case.
dp.create_streaming_table(name=CURRENT, comment="One row per case, latest version (SCD type 1)")
_cdc = getattr(dp, "create_auto_cdc_flow", None) or dp.apply_changes
_cdc(
    target=CURRENT,
    source=SILVER,
    keys=["case_key"],
    sequence_by=F.col("modified_at"),
    stored_as_scd_type=1,
)
