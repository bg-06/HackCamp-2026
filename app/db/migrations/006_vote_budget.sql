-- Current votes retain the existing Databricks contract. Immutable casts survive
-- removing a vote, so removing/recasting cannot refund the Vancouver-day allowance.
CREATE TABLE IF NOT EXISTS vote_casts (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  issue_id text NOT NULL,
  cast_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id, cast_at)
);
CREATE INDEX IF NOT EXISTS vote_casts_user_time_idx ON vote_casts (user_id, cast_at);

CREATE TABLE IF NOT EXISTS vote_daily_usage (
  user_id text NOT NULL,
  vote_day date NOT NULL,
  votes_used smallint NOT NULL CHECK (votes_used BETWEEN 0 AND 2),
  PRIMARY KEY (user_id, vote_day)
);

-- Preserve existing upvote timestamps when upgrading. Legacy downvotes remain in
-- votes for compatibility but the API and new score ignore them.
INSERT INTO vote_casts (user_id, issue_id, cast_at)
SELECT user_id, issue_id, created_at FROM votes WHERE user_id IS NOT NULL AND value = 1
ON CONFLICT (user_id, issue_id, cast_at) DO NOTHING;

INSERT INTO vote_daily_usage (user_id, vote_day, votes_used)
SELECT user_id, (cast_at AT TIME ZONE 'America/Vancouver')::date, least(count(*), 2)::smallint
FROM vote_casts GROUP BY user_id, (cast_at AT TIME ZONE 'America/Vancouver')::date
ON CONFLICT (user_id, vote_day) DO UPDATE
SET votes_used = greatest(vote_daily_usage.votes_used, EXCLUDED.votes_used);
