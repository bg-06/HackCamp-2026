# Databricks notebook source
# Refresh gold tables that join the app's Postgres tables (votes, events): databricks/sql/rankings.sql.
# A statement whose "-- @requires <table>" doesn't exist yet is skipped, so the job works before
# the app has created its tables.

import pathlib
import re

# Postgres done_at is an instant; compare it with explicitly UTC-converted case timestamps.
spark.conf.set("spark.sql.session.timeZone", "UTC")

SQL_FILE = pathlib.Path.cwd().parent / "sql" / "rankings.sql"

statements = [s.strip() for s in SQL_FILE.read_text().split(";") if s.strip()]
ran, skipped = [], []
for stmt in statements:
    body = "\n".join(l for l in stmt.splitlines() if not l.strip().startswith("--")).strip()
    if not body:
        continue
    target = re.search(r"TABLE\s+(\S+)", body).group(1)
    needs = re.findall(r"@requires\s+(\S+)", stmt)
    missing = [t for t in needs if not spark.catalog.tableExists(t)]
    if missing:
        skipped.append(f"{target} (missing {', '.join(missing)})")
        continue
    spark.sql(body)
    ran.append(target)

print("refreshed:", ran or "nothing")
print("skipped:", skipped or "nothing")
dbutils.jobs.taskValues.set("refreshed", ran)
