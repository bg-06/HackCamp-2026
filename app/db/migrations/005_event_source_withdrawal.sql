-- External listings are soft-withdrawn so comments, RSVPs and stable detail URLs survive.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS source_withdrawn_at timestamptz;

CREATE INDEX IF NOT EXISTS events_active_source_idx
  ON events (created_by, source_withdrawn_at, starts_at);
