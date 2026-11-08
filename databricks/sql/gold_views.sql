-- Gold layer for GreenHands BC. Runs inside t311_pipeline after silver.
-- Views that read the app's Postgres tables (votes, events) live in rankings.sql instead,
-- so the pipeline still runs before the app has created those tables.

-- Category and AI track per request type. Stored labels (bbb.gold.type_labels) are used as they
-- are, because ai_classify gives different answers from run to run. Only request types not stored
-- yet get an AI call; the freeze_type_labels job task then stores them, so each type is labelled once.
CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.type_categories
COMMENT 'Resident-friendly category and AI track (neighbours / city / none) for each City 311 request type'
AS WITH types AS (
  SELECT DISTINCT request_type FROM bbb.silver.t311_cases_current WHERE request_type IS NOT NULL
)
SELECT t.request_type, l.category, l.ai_track
FROM types t JOIN bbb.gold.type_labels l USING (request_type)
UNION ALL
SELECT request_type,
       ai_classify(request_type, ARRAY(
         'Roads and Sidewalks', 'Garbage and Dumping', 'Graffiti', 'Noise', 'Parks and Trees',
         'Water and Sewer', 'Lighting and Signals', 'Parking', 'Animals',
         'Permits and Licences', 'Housing and Property', 'Other')) AS category,
       -- Which track: can neighbours help, or does only the City fix it? (labels max 50 chars)
       CASE ai_classify(request_type, ARRAY(
              'litter or graffiti volunteers can clean up',
              'outdoor repair only City crews can do',
              'not a physical problem at a place'))
         WHEN 'litter or graffiti volunteers can clean up' THEN 'neighbours'
         WHEN 'outdoor repair only City crews can do' THEN 'city'
         ELSE 'none' END AS ai_track
FROM types LEFT ANTI JOIN bbb.gold.type_labels USING (request_type);

-- Track = hand override (bbb.gold.track_overrides, created by setup.sql) if present, else the AI's.
CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.cases_enriched
COMMENT 'Latest version of each case with category, track and resolution time in days'
AS SELECT c.*, t.category, coalesce(o.track, t.ai_track) AS track,
       datediff(c.closed_on, to_date(c.opened_at)) AS resolution_days
FROM bbb.silver.t311_cases_current c
LEFT JOIN bbb.gold.type_categories t USING (request_type)
LEFT JOIN (SELECT request_type, max(track) AS track FROM bbb.gold.track_overrides GROUP BY request_type) o
  USING (request_type);

CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.hotspots_h3
COMMENT 'Open issues per H3 res-9 cell, track and category, opened in the last 90 days (map)'
AS SELECT h3_r9, track, category, count(*) AS open_count
FROM bbb.gold.cases_enriched
WHERE status = 'Open' AND track IN ('neighbours', 'city') AND h3_r9 IS NOT NULL
  AND opened_at >= current_date() - INTERVAL 90 DAYS
GROUP BY h3_r9, track, category;

CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.area_weekly
COMMENT 'Cases opened and median resolution days per local area, category and week'
AS SELECT local_area, category, date_trunc('week', opened_at) AS week,
       count(*) AS opened, percentile_approx(resolution_days, 0.5) AS median_days
FROM bbb.gold.cases_enriched
GROUP BY ALL;

CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.recurring_issues
COMMENT 'Same request type in the same H3 cell across 4+ distinct months'
AS SELECT h3_r9, request_type, count(*) AS times_reported,
       count(DISTINCT date_trunc('month', opened_at)) AS months_seen
FROM bbb.gold.cases_enriched
WHERE h3_r9 IS NOT NULL
GROUP BY ALL
HAVING months_seen >= 4;

-- Track 1: recurring spots in the last year where neighbours can help.
CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.help_hotspots
COMMENT 'Track 1: recurring spots (3+ months in the last year) that volunteers can help with'
AS SELECT h3_r9, request_type, category,
       max_by(local_area, opened_at) AS local_area,
       count(*) AS times_reported,
       count(DISTINCT date_trunc('month', opened_at)) AS months_seen,
       max(opened_at) AS last_reported
FROM bbb.gold.cases_enriched
WHERE track = 'neighbours' AND h3_r9 IS NOT NULL
  AND opened_at >= current_date() - INTERVAL 12 MONTHS
GROUP BY h3_r9, request_type, category
HAVING months_seen >= 3;

-- Track 2: an "issue" is one request type in one H3 cell with open cases (no public City case ID).
-- base_score uses City data only; votes are added in rankings.sql and in the app.
CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.track2_issues
COMMENT 'Track 2: open City-only issues people can vote on, with a base score from City data'
AS WITH recent AS (
  SELECT h3_r9, request_type, count(*) AS times_reported_12m
  FROM bbb.gold.cases_enriched
  WHERE track = 'city' AND h3_r9 IS NOT NULL AND opened_at >= current_date() - INTERVAL 12 MONTHS
  GROUP BY ALL
)
SELECT sha2(concat(o.h3_r9, '|', o.request_type), 256) AS issue_id,
       o.h3_r9, o.request_type, o.category, o.local_area, o.address, o.open_cases, o.days_open,
       coalesce(r.times_reported_12m, 0) AS times_reported_12m,
       least(o.days_open, 90) / 10.0 + coalesce(r.times_reported_12m, 0) AS base_score
FROM (
  SELECT h3_r9, request_type,
         max_by(category, opened_at) AS category,
         max_by(local_area, opened_at) AS local_area,
         max_by(address, opened_at) AS address,
         count(*) AS open_cases,
         datediff(current_date(), min(opened_at)) AS days_open
  FROM bbb.gold.cases_enriched
  WHERE track = 'city' AND status = 'Open' AND h3_r9 IS NOT NULL
  GROUP BY h3_r9, request_type
) o
LEFT JOIN recent r USING (h3_r9, request_type);
