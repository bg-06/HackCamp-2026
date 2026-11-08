# Databricks notebook source
# AI-written weekly summary per local area (22 areas = 22 model calls).
# Runs on Mondays, or whenever `force` is true or the table doesn't exist yet.

import datetime as dt

dbutils.widgets.text("endpoint", "databricks-meta-llama-3-3-70b-instruct")
dbutils.widgets.dropdown("force", "false", ["true", "false"])

endpoint = dbutils.widgets.get("endpoint")
force = dbutils.widgets.get("force") == "true"
exists = spark.catalog.tableExists("bbb.gold.area_summaries")

if not (force or not exists or dt.date.today().weekday() == 0):
    dbutils.notebook.exit("skipped: not Monday (set force=true to run anyway)")

spark.sql(f"""
CREATE OR REPLACE TABLE bbb.gold.area_summaries
COMMENT 'AI-written weekly summary per local area'
AS SELECT local_area, current_date() AS generated_on,
       ai_query('{endpoint}',
         concat('Write 3 plain sentences for residents of ', local_area,
                ', Vancouver, about their neighbourhood this week. Say where neighbours could help most, ',
                'which City-only issue is most pressing, and how fast the City is fixing things. ',
                'No hype, no lists, no headings. Data (JSON): ', stats)) AS summary
FROM (
  SELECT local_area,
         to_json(collect_list(struct(category, opened, median_days))) AS stats
  FROM bbb.gold.area_weekly
  WHERE local_area IS NOT NULL
    AND week >= date_trunc('week', current_date() - INTERVAL 7 DAYS)
  GROUP BY local_area
)
""")

print(spark.table("bbb.gold.area_summaries").count(), "area summaries written")
