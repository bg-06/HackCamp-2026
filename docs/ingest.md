# Vancouver data ingest (TypeScript)

The TypeScript ingest service in `app/` mirrors Vancouver Open Data into PostgreSQL using `postgres.js`. API geometries are stored as GeoJSON in `jsonb`, so the database does not require PostGIS.

## Sources

- `3-1-1-service-requests`: all request types, append-only, for Databricks federation.
- `road-ahead-projects-under-construction`: complete transactional snapshot.
- `road-ahead-upcoming-projects`: complete transactional snapshot.
- `local-area-boundary`: complete transactional snapshot for neighbourhood and nearby-task lookups.

Keeping all 311 types is intentional: the updated product needs both volunteer-track and City-only issues, and Databricks owns classification into categories/tracks.

## Setup

From `app/`:

```sh
npm install
npm run db:migrate
npm run ingest:history
```

The scripts read the root `.env` when run from the repository root, or environment variables supplied by deployment. `DATABASE_URL` is supported; otherwise they use the separate `POSTGRES_*` fields.

From the repository root, run:

```sh
npm --prefix app run db:migrate
npm --prefix app run ingest:history
npm --prefix app run ingest
npm --prefix app run ingest:status
```

## Freshness

The one-time historical load reads `data/raw/3-1-1-service-requests.parquet` locally and streams it into PostgreSQL with `COPY`; it does not call the City API. It truncates and replaces `raw_311_requests`.

Schedule `npm --prefix app run ingest` hourly or daily afterward. Incremental 311 refreshes read `max(last_modified_timestamp)` from `raw_311_requests` and fetch only newer source rows. Updated City records are appended as new rows; Databricks silver keeps the current version.

```cron
15 * * * * cd /path/to/HackCamp-2026 && npm --prefix app run ingest >> /var/log/greenhands-bc-ingest.log 2>&1
```

## Tables

- `raw_311_requests`: exact append-only Databricks contract: `id`, the 12 City fields, and `fetched_at`.
- `votes`: minimum ranking contract: `issue_id`, `value` (`-1` or `1`).
- `events`: minimum impact contract: `id`, `h3_r9`, `category`, `done_at`.
- `road_projects`: current and upcoming project geometry as GeoJSON `jsonb`.
- `local_areas`: Vancouver's 22 local-area polygons as GeoJSON `jsonb`.
- `ingest_state`: operational status for each fetched source; Databricks does not depend on it.

The app treats `gold_*` tables as read-only. Their authoritative definitions belong in `databricks/postgres/gold_tables.sql` and should be applied as a separate migration rather than duplicated here.
