# Vancouver data ingest (TypeScript)

The TypeScript ingest service in `app/` mirrors Vancouver Open Data into PostgreSQL/PostGIS using `postgres.js`.

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
npm run ingest -- --full
```

The scripts read the root `.env` when run from the repository root, or environment variables supplied by deployment. `DATABASE_URL` is supported; otherwise they use the separate `POSTGRES_*` fields.

From the repository root, run:

```sh
npm --prefix app run db:migrate
npm --prefix app run ingest -- --full
npm --prefix app run ingest
npm --prefix app run ingest:status
```

## Freshness

Schedule `npm --prefix app run ingest` hourly or daily. The 311 import stores a high-water timestamp and re-fetches a two-day overlap. Duplicate versions are ignored by `(source_hash, last_modified_timestamp)`.

```cron
15 * * * * cd /path/to/HackCamp-2026 && npm --prefix app run ingest >> /var/log/blockbyblock-ingest.log 2>&1
```

## Tables and views

- `raw_311_requests`: append-only source landing table read by Databricks.
- `raw_311_current`: latest known version of each inferred source record.
- `road_projects`: current and upcoming project geometry.
- `local_areas`: Vancouver's 22 local-area polygons.
- `volunteer_source_tasks`: open, geocoded 311 records residents may be able to address.
- `ingest_state`: cursor, source processing time, row count, and error status.

Vancouver exposes no public 311 case ID. `source_hash` is inferred from the best available identity fields, so truly indistinguishable source duplicates can collapse. Raw versions remain append-only by inferred identity and modification timestamp.
