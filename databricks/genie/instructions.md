# Genie space instructions

Space name suggestion: `Block by Block: Vancouver 311`. Warehouse: the same SQL warehouse as the dashboard.

## Tables to add to the Genie space

- `bbb.gold.cases_enriched`
- `bbb.gold.recurring_issues`
- `bbb.gold.help_hotspots`
- `bbb.gold.track2_issues`
- `bbb.gold.hotspots_h3`
- `bbb.gold.area_weekly`
- `bbb.gold.type_categories`
- `bbb.gold.track_overrides`

## General instructions (paste into the Instructions box)

This data is Vancouver 311 service requests. Every request type has an AI-assigned track. Track 1 (`track = 'neighbours'`) means volunteers and neighbours can help, for example graffiti, litter and small dumping. Track 2 (`track = 'city'`) means only the City can fix it, for example potholes and street repair. `track = 'none'` means neither applies.
In `cases_enriched`, `status` is only `Open` or `Close`. `opened_at` is Vancouver local time. About a third of cases have coordinates (`latitude`, `longitude`), and 21% of cases have no `local_area`, so filter out NULL `local_area` when grouping by neighbourhood.
`h3_r9` is an H3 cell at resolution 9, roughly a city block or two. `base_score` in `track2_issues` ranks Track 2 issues by days open plus repeat reports; a higher score is more pressing. `resolution_days` can be null for open cases, so filter `closed_on IS NOT NULL` when measuring how fast cases close.
`track_overrides` holds a few hand-made corrections to the AI track; the final track for a request type is `coalesce(o.track, t.ai_track)` when joining `type_categories` t to `track_overrides` o. When the user says "last week", "this year" or "recently", measure from the latest `opened_at` in the data, not from today's date, because the data may lag behind. Questions about how fast "the City" closes cases cover all closed cases in `cases_enriched`; do not add a `track` filter unless the user names a track, and rank categories by median `resolution_days`.

## Sample questions and SQL

Add each as an example SQL query in the Genie space. Questions 1-8 are the required set; 3 has an alternative version.

### 1. Which neighbourhood has the most recurring dumping?

```sql
WITH area_of AS (SELECT h3_r9, max(local_area) AS local_area FROM bbb.gold.cases_enriched WHERE h3_r9 IS NOT NULL AND local_area IS NOT NULL GROUP BY h3_r9) SELECT a.local_area, count(*) AS recurring_spots, sum(r.times_reported) AS reports FROM bbb.gold.recurring_issues r JOIN bbb.gold.type_categories t USING (request_type) JOIN area_of a USING (h3_r9) WHERE t.category = 'Garbage and Dumping' GROUP BY a.local_area ORDER BY recurring_spots DESC, reports DESC;
```

### 2. What are the 5 most pressing City issues in Mount Pleasant?

```sql
SELECT request_type, address, open_cases, days_open, times_reported_12m, round(base_score, 1) AS score FROM bbb.gold.track2_issues WHERE local_area = 'Mount Pleasant' ORDER BY base_score DESC LIMIT 5;
```

### 3. How many Track 1 hotspots does each area have?

```sql
SELECT local_area, count(*) AS hotspots FROM bbb.gold.help_hotspots WHERE local_area IS NOT NULL GROUP BY local_area ORDER BY hotspots DESC;
```

**Alternative for question 3:** counts spots with 3+ Track 1 cases in the last 12 months of data, computed directly from `cases_enriched`.

```sql
SELECT local_area, count(*) AS hotspots FROM (SELECT local_area, h3_r9, request_type FROM bbb.gold.cases_enriched WHERE track = 'neighbours' AND local_area IS NOT NULL AND h3_r9 IS NOT NULL AND opened_at >= (SELECT max(opened_at) FROM bbb.gold.cases_enriched) - INTERVAL 12 MONTHS GROUP BY local_area, h3_r9, request_type HAVING count(*) >= 3) GROUP BY local_area ORDER BY hotspots DESC;
```

### 4. Which category does the City close slowest?

```sql
SELECT category, percentile_approx(resolution_days, 0.5) AS median_days, count(*) AS closed_cases FROM bbb.gold.cases_enriched WHERE closed_on IS NOT NULL AND resolution_days >= 0 GROUP BY category HAVING count(*) >= 100 ORDER BY median_days DESC;
```

### 5. How many cases were opened last week?

```sql
SELECT count(*) AS cases_opened FROM bbb.gold.cases_enriched WHERE opened_at >= (SELECT max(opened_at) FROM bbb.gold.cases_enriched) - INTERVAL 7 DAYS;
```

### 6. Which request types did the AI put in Track 1?

```sql
SELECT t.request_type, t.category FROM bbb.gold.type_categories t LEFT JOIN bbb.gold.track_overrides o USING (request_type) WHERE coalesce(o.track, t.ai_track) = 'neighbours' ORDER BY t.category, t.request_type;
```

### 7. Where is graffiti reported most often?

```sql
SELECT local_area, count(*) AS reports FROM bbb.gold.cases_enriched WHERE category = 'Graffiti' AND local_area IS NOT NULL GROUP BY local_area ORDER BY reports DESC;
```

### 8. How has the number of reports changed month by month this year?

```sql
SELECT date_trunc('month', opened_at) AS month, count(*) AS reports FROM bbb.gold.cases_enriched WHERE year(opened_at) = (SELECT year(max(opened_at)) FROM bbb.gold.cases_enriched) GROUP BY ALL ORDER BY month;
```

## Creating or updating the space

From the repo root, with the `databricks` CLI logged in:

```
python databricks/genie/create_space.py
```

The script reads this file and creates the space `Block by Block: Vancouver 311`, or updates it if it already exists. Note the space list can lag a few seconds behind a create, so do not run it twice in quick succession on a first run.

Space: https://dbc-7f6625ff-1e9b.cloud.databricks.com/genie/rooms/01f1db2da43c1526bbb552326b18618c
