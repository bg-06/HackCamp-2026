# 311 data shape

Pulled 2026-11-07 from `opendata.vancouver.ca` dataset `3-1-1-service-requests` (portal last processed 2026-11-07 15:05 UTC).
Re-run with `python scripts/pull_311_sample.py [--days 7] [--full]`.

| File | What | In git |
|---|---|---|
| `data/sample/schema.json` | Field names and types from the catalog | yes |
| `data/sample/311_recent.jsonl` | 6,750 records modified since 2026-10-31 (same `where` as the ingest task) | yes |
| `data/sample/profile.json` | Value counts for categorical fields, null rates, open-date range | yes |
| `data/raw/3-1-1-service-requests.parquet` | Full export, 1,324,622 rows, 48 MB | no (gitignored) |

## Fields

| Field | Type | Notes |
|---|---|---|
| `department` | text | 70 distinct, e.g. `ENG - Sanitation Services` |
| `service_request_type` | text | 256 distinct, all end in `Case` (e.g. `Pothole Case`) |
| `status` | text | Only `Close` (1,307,941) and `Open` (16,681) |
| `closure_reason` | text | 18 values, never null. `N/A` / `Unknown` used instead of null |
| `service_request_open_timestamp` | datetime | **UTC** (`2026-06-28T14:07:27+00:00`) |
| `service_request_close_date` | date | **Vancouver local date**, null only when open |
| `last_modified_timestamp` | datetime | UTC |
| `address` | text | Uppercase street form, `1905 OGDEN AV`, or intersections `5600 CYPRESS ST and W 41ST AV` |
| `local_area` | text | 22 neighbourhoods, null on 21% of rows |
| `channel` | text | `WEB`, `Phone`, `Mobile App`, `Chat`, `E-mail`, ... |
| `latitude`, `longitude` | double | Null on 66% of rows |
| `geom` | geo_point_2d | WKB bytes in parquet; duplicate of lat/lon, drop it |

## Things that change the plan

1. **Data starts 2022-01-01, not August 2022.** About 270k rows per year, roughly 5k a week.
2. **Only 34% of rows have coordinates.** Geocoding is all-or-nothing by request type: 109 of 256 types are mostly geocoded, and big ones like `Building and Development Inquiry`, missed bin pickups, parking enforcement and noise have none. The map shows a subset of types; area pages can still use all rows that have `local_area`.
3. **The planned `case_key` is not unique.** `sha2(request_type | opened_at | address | local_area)` collides on 13,916 rows (about 1%), mostly bulk-entered cases with null address. With SCD1 CDC those get merged into one. Adding `department, channel, latitude, longitude` only drops it to 12,778, so there is no natural key. Options: accept the ~1% merge, or keep the silver table append-only and dedupe by key + `last_modified_timestamp` instead of upserting.
4. **Timezones.** Computing `datediff(close_date, to_date(opened_at))` in UTC gives 44,206 negative resolution times. Converting `opened_at` to `America/Vancouver` first drops that to 27. Use `to_date(from_utc_timestamp(opened_at, 'America/Vancouver'))`.
5. **Status filter.** `status NOT ILIKE 'close%'` works, but `status = 'Open'` is simpler and exact.
6. **Bounding box is fine.** 99.999% of geocoded points fall in the silver `in_vancouver` expectation; a handful sit just outside (min lat 49.098, min lon -123.385).
7. **7,408 geocoded rows have null `local_area`.** Could backfill from a local-area boundary polygon (also on the open data portal) if needed.
8. **Resolution days:** median 2, p90 16, p99 172.

## Rough volumes

- Top local areas: Downtown 114k, Kensington-Cedar Cottage 86k, Kitsilano 71k
- Top types: Building and Development Inquiry 118k, Business Licence Request 69k, Garbage Bin Request 62k, Missed Green Bin Pickup 62k, City and Park Trees Maintenance 54k
- Incremental pull for one week of modifications is about 6.7k records, 3 MB of JSON
