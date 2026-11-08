-- Raw volunteer source records for Databricks federation.
CREATE TABLE IF NOT EXISTS raw_volunteer_events (
  source text NOT NULL,
  source_key text NOT NULL,
  record_type text NOT NULL,
  title text NOT NULL,
  organiser text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  municipality text,
  category text,
  signup_url text,
  source_url text NOT NULL,
  published_at timestamptz,
  raw_record jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_key)
);

CREATE INDEX IF NOT EXISTS raw_volunteer_events_starts_idx ON raw_volunteer_events (starts_at);
CREATE INDEX IF NOT EXISTS raw_volunteer_events_type_idx ON raw_volunteer_events (record_type, source);
