# Databricks notebook source
# Store the AI labels of request types that are new since the last run in bbb.gold.type_labels.
# bbb.gold.type_categories only calls ai_classify for types missing from that table, so once a
# type is stored here its category and track stay the same on every later run.
# New types are printed so someone can check them; fix a wrong track in bbb.gold.track_overrides.

new = spark.sql("""
  SELECT c.request_type, c.category, c.ai_track
  FROM bbb.gold.type_categories c
  LEFT ANTI JOIN bbb.gold.type_labels l USING (request_type)
""").collect()

spark.sql("""
  MERGE INTO bbb.gold.type_labels t
  USING bbb.gold.type_categories s
  ON t.request_type = s.request_type
  WHEN NOT MATCHED THEN INSERT (request_type, category, ai_track, labelled_at)
    VALUES (s.request_type, s.category, s.ai_track, current_timestamp())
""")

if new:
    print(f"stored {len(new)} new request type(s); check their track:")
    for r in new:
        print(f"  {r.ai_track:<10} {r.category:<22} {r.request_type}")
else:
    print("no new request types")
dbutils.jobs.taskValues.set("new_types", [r.request_type for r in new])
