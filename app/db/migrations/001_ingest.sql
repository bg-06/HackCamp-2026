
CREATE TABLE IF NOT EXISTS ingest_state (
    dataset_id text PRIMARY KEY,
    last_started_at timestamptz,
    last_succeeded_at timestamptz,
    last_error text,
    rows_loaded bigint NOT NULL DEFAULT 0,
    source_processed_at timestamptz
);

-- Exact Lakehouse Federation contract consumed by the Databricks pipeline.
-- Append-only: updated City records are inserted again with a newer timestamp.
CREATE TABLE IF NOT EXISTS raw_311_requests (
    id bigserial PRIMARY KEY,
    department text,
    service_request_type text,
    status text,
    closure_reason text,
    service_request_open_timestamp timestamptz,
    service_request_close_date date,
    last_modified_timestamp timestamptz,
    address text,
    local_area text,
    channel text,
    latitude double precision,
    longitude double precision,
    fetched_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'raw_311_requests'
          AND column_name IN ('ingest_id', 'source_hash', 'source_record', 'ingested_at')
    ) THEN
        RAISE EXCEPTION 'raw_311_requests uses the obsolete ingest schema; drop it before applying this migration';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS raw_311_modified_idx ON raw_311_requests (last_modified_timestamp);
CREATE INDEX IF NOT EXISTS raw_311_type_idx ON raw_311_requests (service_request_type);

-- Minimum app-side contracts read by Databricks rankings and event impact jobs.
CREATE TABLE IF NOT EXISTS votes (
    issue_id text NOT NULL,
    value smallint NOT NULL CHECK (value IN (-1, 1))
);

CREATE INDEX IF NOT EXISTS votes_issue_idx ON votes (issue_id);

CREATE TABLE IF NOT EXISTS events (
    id text PRIMARY KEY,
    h3_r9 text,
    category text,
    done_at timestamptz
);

CREATE INDEX IF NOT EXISTS events_done_idx ON events (done_at) WHERE done_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS road_projects (
    source_key text PRIMARY KEY,
    dataset_id text NOT NULL,
    project_status text NOT NULL CHECK (project_status IN ('under_construction', 'upcoming')),
    project text,
    street text,
    location text,
    completion_date date,
    url_link text,
    geom jsonb,
    representative_point jsonb,
    source_record jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS road_projects_dataset_idx ON road_projects (dataset_id, project_status);

CREATE TABLE IF NOT EXISTS local_areas (
    name text PRIMARY KEY,
    geom jsonb NOT NULL,
    representative_point jsonb,
    source_record jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);




