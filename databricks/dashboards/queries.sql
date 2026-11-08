-- 1. Track 1: where neighbours can help, by area (bar chart)
SELECT local_area, count(*) AS hotspots, sum(times_reported) AS reports
FROM bbb.gold.help_hotspots
WHERE local_area IS NOT NULL
GROUP BY local_area
ORDER BY hotspots DESC;

-- 2. Track 2: most pressing City-only issues (table)
SELECT local_area, request_type, address, open_cases, days_open, times_reported_12m, round(base_score, 1) AS score
FROM bbb.gold.track2_issues
ORDER BY base_score DESC
LIMIT 25;

-- 3. Cases opened per week, by track, last 12 months (line chart)
SELECT date_trunc('week', opened_at) AS week, track, count(*) AS cases
FROM bbb.gold.cases_enriched
WHERE opened_at >= current_date() - INTERVAL 12 MONTHS AND track IN ('neighbours', 'city')
GROUP BY ALL
ORDER BY week;

-- 4. How fast the City closes cases, by category (bar chart)
SELECT category, percentile_approx(resolution_days, 0.5) AS median_days, count(*) AS closed_cases
FROM bbb.gold.cases_enriched
WHERE closed_on IS NOT NULL AND resolution_days >= 0 AND opened_at >= current_date() - INTERVAL 12 MONTHS
GROUP BY category
ORDER BY median_days DESC;

-- 5. Open issues in the last 90 days, as points (point map)
SELECT latitude, longitude, track, category, request_type
FROM bbb.gold.cases_enriched
WHERE status = 'Open' AND track IN ('neighbours', 'city') AND latitude IS NOT NULL
  AND opened_at >= current_date() - INTERVAL 90 DAYS;

-- 6. AI sorting: how many request types landed in each category and track (table)
SELECT t.category, coalesce(o.track, t.ai_track) AS track, count(*) AS request_types
FROM bbb.gold.type_categories t
LEFT JOIN bbb.gold.track_overrides o USING (request_type)
GROUP BY ALL
ORDER BY request_types DESC;
