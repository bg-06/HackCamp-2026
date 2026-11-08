-- Only successful, precise matches are cached. Broad areas never become point locations.
CREATE TABLE IF NOT EXISTS event_geocodes (
  address text PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  matched_address text NOT NULL,
  precision text NOT NULL,
  score integer NOT NULL,
  provider text NOT NULL DEFAULT 'bc-geocoder',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
