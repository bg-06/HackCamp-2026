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
-- Read by bbb.gold.cases_enriched. Edit with plain INSERT / DELETE.
CREATE TABLE IF NOT EXISTS bbb.gold.track_overrides (
  request_type STRING NOT NULL,
  track STRING NOT NULL,
  note STRING
) COMMENT 'Manual corrections to the AI track for a 311 request type';

-- Frozen AI category and track per request type (seeded by type_labels_seed.sql, new types added
-- by the freeze_type_labels job task). Read by bbb.gold.type_categories.
CREATE TABLE IF NOT EXISTS bbb.gold.type_labels (
  request_type STRING NOT NULL,
  category STRING,
  ai_track STRING,
  labelled_at TIMESTAMP
) COMMENT 'Stored AI labels per 311 request type, so labels stay the same between pipeline runs';

-- Seed overrides: Track 1 picks from ai_classify (checked 2026-11-07) that volunteers shouldn't do.
-- MERGE so re-running setup updates these rows and leaves any rows added by hand alone.
MERGE INTO bbb.gold.track_overrides t
USING (SELECT * FROM VALUES
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
  ('Adopt a Catch Basin Program Inquiry Case',           'none', 'program inquiry, not a place'),
  -- Added 2026-11-07 after the full 2022-2026 load (checked against case counts).
  -- AI 'city' picks that aren't a repair people can vote on:
  ('Garbage Bin Request Case',                           'none', 'bin for one home, not a public problem'),
  ('City Construction Project Concern Case',             'none', 'complaint about City work already underway'),
  ('Street Construction Concern Case',                   'none', 'complaint about construction already underway'),
  ('Construction Related Concerns Case',                 'none', 'complaint about construction already underway'),
  ('Traffic Operations Construction Concern Case',       'none', 'complaint about construction already underway'),
  ('Sewer Construction Concern Case',                    'none', 'complaint about construction already underway'),
  ('Waterworks Operations Construction Concern Case',    'none', 'complaint about construction already underway'),
  ('Residential Street Curbside Sign Request Case',      'none', 'parking regulation request, not a repair'),
  ('Arterial St. Curbside Sign - New Request Case',      'none', 'parking regulation request, not a repair'),
  ('Arterial St. Curbside Sign - Modify Request Case',   'none', 'parking regulation request, not a repair'),
  ('Commercial Street Curbside Sign Request Case',       'none', 'parking regulation request, not a repair'),
  ('Business Patio Inquiry Case',                        'none', 'inquiry, not a place'),
  ('Traffic Management Inquiry Case',                    'none', 'inquiry, not a place'),
  ('Sewer Drainage and Design Inquiry Case',             'none', 'inquiry, not a place'),
  ('Sewer Operations Inquiry Case',                      'none', 'inquiry, not a place'),
  ('Sidewalk Snow and Ice Removal Bylaw Inquiry Case',   'none', 'inquiry, not a place'),
  ('Sidewalk Snow and Ice Removal Bylaw Violation Case', 'none', 'bylaw enforcement on a property owner'),
  ('Unpermitted Construction Container Concern Case',    'none', 'bylaw enforcement on a property owner'),
  ('Water Service Line Turn On or Off Request Case',     'none', 'service request for one property'),
  ('Locate Water Service Line or Valve Case',            'none', 'service request for one property'),
  ('Disaster Event Case',                                'none', 'emergency, not a repair to vote on'),
  ('Community Scientist - Post-rain Inspection',         'none', 'volunteer inspection report, not a problem'),
  -- AI 'neighbours' picks volunteers shouldn't take on:
  ('Graffiti Removal - External Organization Case',      'none', 'utility or agency box, owner must remove it'),
  ('Park Improvement Case',                              'none', 'suggestion, not a clean-up'),
  ('Election Sign Concern Case',                         'none', 'campaign signs, bylaw matter'),
  ('Sanitation Operations Inquiry Case',                 'none', 'inquiry, not a place'),
  ('Illegal Dumping Case',                               'city', 'usually bulky items, needs a City pickup'),
  -- AI 'none' picks that are a City repair at a place:
  ('Parks Washroom Servicing Case',                      'city', 'City maintains park washrooms')
  AS v(request_type, track, note)
) s
ON t.request_type = s.request_type
WHEN MATCHED THEN UPDATE SET track = s.track, note = s.note
WHEN NOT MATCHED THEN INSERT (request_type, track, note) VALUES (s.request_type, s.track, s.note);
