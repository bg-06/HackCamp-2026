-- Keep event image payloads separate from the frequently queried events table.
-- 10 MiB is large enough for event photography while bounding database/API memory use.
CREATE TABLE IF NOT EXISTS event_images (
  event_id     text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  data         bytea NOT NULL,
  mime_type    text NOT NULL,
  source_url   text,
  attribution  text,
  license      text,
  byte_length  integer GENERATED ALWAYS AS (octet_length(data)) STORED,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(data) BETWEEN 1 AND 10485760),
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  CHECK (source_url IS NULL OR source_url ~ '^https?://'),
  CHECK (length(attribution) <= 1000),
  CHECK (length(license) <= 255)
);
