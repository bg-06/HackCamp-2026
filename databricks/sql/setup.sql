-- One-time workspace setup, run by databricks/setup/setup_postgres.py (it fills in ${...} from `env`).
-- Credentials come from the `bbb` secret scope, so nothing secret is in this file.

CREATE CATALOG IF NOT EXISTS bbb;
CREATE SCHEMA IF NOT EXISTS bbb.bronze;
CREATE SCHEMA IF NOT EXISTS bbb.silver;
CREATE SCHEMA IF NOT EXISTS bbb.gold;

-- Our Postgres, readable from Unity Catalog (Lakehouse Federation is read-only).
CREATE CONNECTION IF NOT EXISTS bbb_pg TYPE postgresql
OPTIONS (
  host '${pg_host}',
  port '${pg_port}',
  user secret('bbb', 'pg_user'),
  password secret('bbb', 'pg_password')
);

CREATE FOREIGN CATALOG IF NOT EXISTS bbb_app USING CONNECTION bbb_pg OPTIONS (database '${pg_db}');

-- Hand-checked fixes to the AI's track for a request type ('neighbours' | 'city' | 'none').
-- Read by bbb.gold.cases_enriched; edit with plain INSERT / DELETE.
CREATE TABLE IF NOT EXISTS bbb.gold.track_overrides (
  request_type STRING NOT NULL,
  track STRING NOT NULL,
  note STRING
) COMMENT 'Manual corrections to the AI track for a 311 request type';
