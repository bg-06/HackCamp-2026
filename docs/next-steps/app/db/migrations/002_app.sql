-- App tables for GreenHands BC. Safe to run more than once (IF NOT EXISTS everywhere).
-- Databricks reads events (id, h3_r9, category, done_at) and votes (issue_id, value):
-- never rename or drop those columns (databricks/sql/rankings.sql).

-- events: already exists on our Postgres with (id, h3_r9, category, done_at). Add the app's columns.
CREATE TABLE IF NOT EXISTS events (
  id       text PRIMARY KEY,
  h3_r9    text,
  category text,
  done_at  timestamptz
);
ALTER TABLE events ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS kind            text NOT NULL DEFAULT 'hotspot',  -- city | org | hotspot
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS organiser       text,
  ADD COLUMN IF NOT EXISTS org_id          text,
  ADD COLUMN IF NOT EXISTS starts_at       timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at         timestamptz,
  ADD COLUMN IF NOT EXISTS location        text,
  ADD COLUMN IF NOT EXISTS local_area      text,
  ADD COLUMN IF NOT EXISTS latitude        double precision,
  ADD COLUMN IF NOT EXISTS longitude       double precision,
  ADD COLUMN IF NOT EXISTS spots_total     integer,
  ADD COLUMN IF NOT EXISTS what_to_bring   text,
  ADD COLUMN IF NOT EXISTS signup_url      text,             -- external sign-up (city / org events)
  ADD COLUMN IF NOT EXISTS hotspot_id      text,             -- gold_help_hotspots h3_r9 + request_type it came from
  ADD COLUMN IF NOT EXISTS before_photo_url text,
  ADD COLUMN IF NOT EXISTS after_photo_url  text,
  ADD COLUMN IF NOT EXISTS people_count    integer,
  ADD COLUMN IF NOT EXISTS bags_collected  integer,
  ADD COLUMN IF NOT EXISTS created_by      text,             -- Auth0 user id
  ADD COLUMN IF NOT EXISTS is_sample       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS events_local_area_idx ON events (local_area);

-- votes: already exists with (issue_id, value) and a CHECK value IN (-1, 1). Add who voted.
CREATE TABLE IF NOT EXISTS votes (
  issue_id text NOT NULL,
  value    smallint NOT NULL CHECK (value IN (-1, 1))
);
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS user_id    text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS votes_issue_user_idx ON votes (issue_id, user_id);

CREATE TABLE IF NOT EXISTS orgs (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           text NOT NULL,
  kind           text,          -- community centre, BIA, garden, food program, school, library
  address        text,
  local_area     text,
  latitude       double precision,
  longitude      double precision,
  website        text,
  source_dataset text,          -- Vancouver Open Data dataset id it was seeded from
  source_key     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_dataset, source_key)
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id     text NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  role       text NOT NULL DEFAULT 'admin',       -- admin | member
  approved   boolean NOT NULL DEFAULT false,      -- a moderator approves claims
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS rsvps (
  event_id   text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         bigserial PRIMARY KEY,
  event_id   text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  hidden     boolean NOT NULL DEFAULT false,      -- set by moderators
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_event_idx ON comments (event_id, created_at);

-- Area posts: weekly briefings and event suggestions from the Block Steward agent.
CREATE TABLE IF NOT EXISTS posts (
  id         bigserial PRIMARY KEY,
  local_area text NOT NULL,
  kind       text NOT NULL,                        -- briefing | suggestion
  author     text NOT NULL,                        -- 'block-steward-agent' or an Auth0 user id
  org_id     text REFERENCES orgs (id) ON DELETE SET NULL,
  title      text,
  body       text NOT NULL,
  status     text NOT NULL DEFAULT 'published',    -- published | pending | accepted | dismissed
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_area_idx ON posts (local_area, created_at DESC);

CREATE TABLE IF NOT EXISTS follows (
  user_id    text NOT NULL,
  local_area text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_area)
);
