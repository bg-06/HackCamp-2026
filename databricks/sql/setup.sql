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

-- Seed overrides: Track 1 picks from ai_classify (checked 2026-11-07) that volunteers shouldn't do.
-- MERGE so re-running setup updates these rows and leaves any rows added by hand alone.
MERGE INTO bbb.gold.track_overrides t
USING (VALUES
  ('Feces Clean Up Case',                                'city', 'health hazard, needs City crews'),
  ('Abandoned Mattress Case',                            'city', 'bulky item, needs a City pickup'),
  ('Abandoned Non-Recyclables-Large Case',               'city', 'bulky items, needs a City pickup'),
  ('Street Litter Can Case',                             'city', 'City empties and fixes litter cans'),
  ('Park Litter Can Case',                               'city', 'City empties and fixes litter cans'),
  ('Street Furniture Litter Can Maintenance Case',       'city', 'City maintenance'),
  ('New Litter Can Request Case',                        'city', 'request for the City to install a can'),
  ('Graffiti Removal - Private Property Case',           'none', 'property owner must remove it'),
  ('Graffiti Removal - Commercial Waste Container Case', 'none', 'bin owner must remove it'),
  ('Graffiti Management Program Case',                   'none', 'program inquiry, not a place'),
  ('Adopt a Catch Basin Program Inquiry Case',           'none', 'program inquiry, not a place')
) AS s(request_type, track, note)
ON t.request_type = s.request_type
WHEN MATCHED THEN UPDATE SET track = s.track, note = s.note
WHEN NOT MATCHED THEN INSERT (request_type, track, note) VALUES (s.request_type, s.track, s.note);
