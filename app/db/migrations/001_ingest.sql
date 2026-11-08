CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS ingest_state (
    dataset_id text PRIMARY KEY,
    cursor_value timestamptz,
    last_started_at timestamptz,
    last_succeeded_at timestamptz,
    last_error text,
    rows_loaded bigint NOT NULL DEFAULT 0,
    source_processed_at timestamptz
);

-- Append-only landing table for Databricks federation. Vancouver exposes no case ID.
CREATE TABLE IF NOT EXISTS raw_311_requests (
    ingest_id bigserial PRIMARY KEY,
    source_hash text NOT NULL,
    department text NOT NULL,
    service_request_type text NOT NULL,
    status text NOT NULL,
    closure_reason text,
    service_request_open_timestamp timestamptz NOT NULL,
    service_request_close_date date,
    last_modified_timestamp timestamptz NOT NULL,
    address text,
    local_area text,
    channel text,
    latitude double precision,
    longitude double precision,
    geom geometry(Point, 4326),
    source_record jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_hash, last_modified_timestamp)
);

CREATE INDEX IF NOT EXISTS raw_311_modified_idx ON raw_311_requests (last_modified_timestamp DESC);
CREATE INDEX IF NOT EXISTS raw_311_type_idx ON raw_311_requests (service_request_type);
CREATE INDEX IF NOT EXISTS raw_311_geom_gix ON raw_311_requests USING gist (geom);

CREATE TABLE IF NOT EXISTS road_projects (
    source_key text PRIMARY KEY,
    dataset_id text NOT NULL,
    project_status text NOT NULL CHECK (project_status IN ('under_construction', 'upcoming')),
    project text,
    street text,
    location text,
    completion_date date,
    url_link text,
    geom geometry(Geometry, 4326),
    representative_point geometry(Point, 4326),
    source_record jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS road_projects_geom_gix ON road_projects USING gist (geom);
CREATE INDEX IF NOT EXISTS road_projects_point_gix ON road_projects USING gist (representative_point);

CREATE TABLE IF NOT EXISTS local_areas (
    name text PRIMARY KEY,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    representative_point geometry(Point, 4326),
    source_record jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS local_areas_geom_gix ON local_areas USING gist (geom);

CREATE OR REPLACE VIEW raw_311_current AS
SELECT DISTINCT ON (source_hash) *
FROM raw_311_requests
ORDER BY source_hash, last_modified_timestamp DESC, ingest_id DESC;

CREATE OR REPLACE VIEW volunteer_source_tasks AS
SELECT r.*, COALESCE(r.local_area, a.name) AS resolved_local_area
FROM raw_311_current r
LEFT JOIN LATERAL (
    SELECT name FROM local_areas
    WHERE r.geom IS NOT NULL AND ST_Covers(geom, r.geom)
    LIMIT 1
) a ON true
WHERE r.status = 'Open'
  AND r.geom IS NOT NULL
  AND r.service_request_type IN (
      'Street Cleaning and Debris Pick Up Case',
      'Street Surface Water Flooding Case',
      'City and Park Trees Maintenance Case',
      'Urban Issues in Parks Case',
      'Park Facility Maintenance Request',
      'Parks Operations and Maintenance Case',
      'Park Litter Can Case',
      'Graffiti Removal - Park Property Case',
      'Park Drinking Fountain Maintenance Request'
  );
