-- Gold layer for Block by Block. Runs inside t311_pipeline after silver.

-- One AI call per distinct request type (~256), not per row.
CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.type_categories
COMMENT 'Resident-friendly category for each City 311 request type, assigned by ai_classify'
AS SELECT request_type,
       ai_classify(request_type, ARRAY(
         'Roads and Sidewalks', 'Garbage and Dumping', 'Graffiti', 'Noise', 'Parks and Trees',
         'Water and Sewer', 'Lighting and Signals', 'Parking', 'Animals',
         'Permits and Licences', 'Housing and Property', 'Other')) AS category
FROM (SELECT DISTINCT request_type FROM bbb.silver.t311_cases_current);

CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.cases_enriched
COMMENT 'Latest version of each case with AI category and resolution time in days'
AS SELECT c.*, t.category, datediff(c.closed_on, to_date(c.opened_at)) AS resolution_days
FROM bbb.silver.t311_cases_current c
LEFT JOIN bbb.gold.type_categories t USING (request_type);

CREATE OR REFRESH MATERIALIZED VIEW bbb.gold.hotspots_h3
COMMENT 'Open issues per H3 res-9 cell and category, opened in the last 90 days'
AS SELECT h3_r9, category, count(*) AS open_count
FROM bbb.gold.cases_enriched
WHERE status = 'Open' AND h3_r9 IS NOT NULL AND opened_at >= current_date() - INTERVAL 90 DAYS
GROUP BY h3_r9, category;

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
