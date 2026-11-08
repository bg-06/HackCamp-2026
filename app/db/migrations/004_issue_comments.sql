-- Comments on Track 2 issues as well as on events (the frontend shows a discussion under both).
-- Only adds: a nullable issue_id column, and allows event_id to be empty for issue comments.
-- Each comment is about exactly one thing: an event or an issue.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS issue_id text;  -- gold_track2_issues.issue_id
ALTER TABLE comments ALTER COLUMN event_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_one_target') THEN
    ALTER TABLE comments ADD CONSTRAINT comments_one_target CHECK ((event_id IS NULL) <> (issue_id IS NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS comments_issue_idx ON comments (issue_id, created_at);
