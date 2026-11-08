-- Gold tables that read the app's own Postgres tables through bbb_app.
-- Run by notebooks/refresh_rankings.py after the pipeline (and on demand when n8n says an event is done).
-- Each statement is skipped by the notebook if the Postgres table it needs doesn't exist yet.

-- @requires bbb_app.public.votes
-- Track 2 issues + resident votes, ranked per area (Genie, dashboard, "Send this list to Council").
-- Postgres votes: issue_id text, value smallint (+1 / -1).
CREATE OR REPLACE TABLE bbb.gold.issue_priority
COMMENT 'Track 2 issues with votes, ranked within each local area'
AS SELECT *, rank() OVER (PARTITION BY local_area ORDER BY score DESC) AS area_rank
FROM (
  SELECT i.*, coalesce(v.up, 0) AS up_votes, coalesce(v.down, 0) AS down_votes,
         i.base_score + 3 * (coalesce(v.up, 0) - coalesce(v.down, 0)) AS score
  FROM bbb.gold.track2_issues i
  LEFT JOIN (
    SELECT issue_id, count_if(value = 1) AS up, count_if(value = -1) AS down
    FROM bbb_app.public.votes GROUP BY issue_id
  ) v USING (issue_id)
);

-- @requires bbb_app.public.events
-- Did it work? 311 reports of the event's category in its cell + ring, 60 days before vs after done_at.
-- Postgres events: id, h3_r9 text (res 9), category text, done_at timestamptz.
-- opened_at is a Vancouver wall-clock timestamp; convert it back to UTC before comparing instants.
CREATE OR REPLACE TABLE bbb.gold.event_impact
COMMENT '311 reports near each finished event, 60 days before vs after'
AS SELECT CAST(e.id AS STRING) AS event_id, e.h3_r9, e.category, e.done_at,
       count_if(to_utc_timestamp(c.opened_at, 'America/Vancouver') >= e.done_at - INTERVAL 60 DAYS
                AND to_utc_timestamp(c.opened_at, 'America/Vancouver') < e.done_at) AS reports_60d_before,
       count_if(to_utc_timestamp(c.opened_at, 'America/Vancouver') >= e.done_at
                AND to_utc_timestamp(c.opened_at, 'America/Vancouver') < e.done_at + INTERVAL 60 DAYS) AS reports_60d_after,
       datediff(current_date(), e.done_at) AS days_since_done
FROM bbb_app.public.events e
LEFT JOIN bbb.gold.cases_enriched c
  ON c.category = e.category AND array_contains(h3_kring(e.h3_r9, 1), c.h3_r9)
WHERE e.done_at IS NOT NULL AND e.h3_r9 IS NOT NULL
GROUP BY ALL;
