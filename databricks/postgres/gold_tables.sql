-- Postgres tables that publish_gold fills from bbb.gold (Databricks -> Postgres).
-- Historical schema reference; app/db/migrations/003_gold_tables.sql owns creation.
-- publish_gold.py checks the tables exist and only publishes data.
-- The app reads these; it never writes them. Column order must match TABLES in publish_gold.py.

CREATE TABLE IF NOT EXISTS gold_type_categories (
  request_type text PRIMARY KEY,
  category     text,
  track        text            -- neighbours | city | none (override applied)
);

CREATE TABLE IF NOT EXISTS gold_hotspots_h3 (
  h3_r9      text NOT NULL,
  track      text NOT NULL,
  category   text,
  open_count bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS gold_hotspots_h3_cell ON gold_hotspots_h3 (h3_r9);

CREATE TABLE IF NOT EXISTS gold_help_hotspots (
  h3_r9          text NOT NULL,
  request_type   text NOT NULL,
  category       text,
  local_area     text,
  times_reported bigint,
  months_seen    bigint,
  last_reported  timestamp,     -- Vancouver local time
  PRIMARY KEY (h3_r9, request_type)
);

CREATE TABLE IF NOT EXISTS gold_track2_issues (
  issue_id           text PRIMARY KEY,   -- sha256(h3_r9 || '|' || request_type); votes.issue_id points here
  h3_r9              text NOT NULL,
  request_type       text NOT NULL,
  category           text,
  local_area         text,
  address            text,
  open_cases         bigint,
  days_open          integer,
  times_reported_12m bigint,
  base_score         double precision
);
CREATE INDEX IF NOT EXISTS gold_track2_issues_area ON gold_track2_issues (local_area);

CREATE TABLE IF NOT EXISTS gold_event_impact (
  event_id           text PRIMARY KEY,
  h3_r9              text,
  category           text,
  done_at            timestamptz,
  reports_60d_before bigint,
  reports_60d_after  bigint,
  days_since_done    integer
);

CREATE TABLE IF NOT EXISTS gold_area_summaries (
  local_area   text PRIMARY KEY,
  generated_on date,
  summary      text
);

CREATE TABLE IF NOT EXISTS gold_published (
  table_name   text PRIMARY KEY,
  row_count    bigint,
  published_at timestamptz NOT NULL DEFAULT now()
);
