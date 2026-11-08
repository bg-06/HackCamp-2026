-- Display names, so comments and hosted events never show a raw Auth0 user id.
CREATE TABLE IF NOT EXISTS profiles (
  user_id      text PRIMARY KEY,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Block Steward agent posts (agent/README.md "Payload contract").
-- payload keeps the full JSON (event_draft, hotspot, city_program, org_ids, week_of, model);
-- hotspot_id is pulled out so the "skip repeats" check can use an index.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS payload    jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS hotspot_id text;

-- One row per dedupe_key per org (suggestions store one row per org id, or one with org_id null).
CREATE UNIQUE INDEX IF NOT EXISTS posts_dedupe_org_idx
  ON posts (dedupe_key, coalesce(org_id, '')) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_suggestion_hotspot_idx
  ON posts (hotspot_id, created_at) WHERE kind = 'suggestion';
