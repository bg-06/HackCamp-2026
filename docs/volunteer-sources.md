# Volunteer listing sources

Run the TypeScript adapters with:

```sh
npm --prefix app run ingest:volunteer-events
```

Apply `app/db/migrations/004_volunteer_raw.sql` before running the command; it owns the `raw_volunteer_events` schema. The app migration from Step 5 must also be applied because normalized listings are upserted into `events`. External events keep their organiser's signup URL; Block by Block does not take registrations for them.

## Postgres landing table

`raw_volunteer_events` uses `(source, source_key)` as its primary key and stores record type, dates, location, category, source/signup URLs, the complete raw JSON record, and `fetched_at`. Databricks can read it as `bbb_app.public.raw_volunteer_events` and distinguish:

- `upcoming_event`
- `ongoing_opportunity`
- `completed_activity`

## Current adapters

### Curated City of Vancouver programs

`data/seed/city_volunteer_opportunities.json` contains stable, ongoing opportunities linked to official City pages. The City volunteering index is protected by Cloudflare and is an index of programs rather than an event feed, so these entries are intentionally curated and reviewed instead of scraped.

### Green Teams of Canada official site

The official WordPress REST endpoint provides public activity posts. The adapter currently lands the newest 100 posts as `completed_activity` records. These are useful to Databricks for organizer history, activity classification, locations and impact examples, but they are not upcoming signups.

### Lower Mainland Green Team Meetup

The adapter reads only the public group events HTML and schema.org JSON-LD. It does not call Meetup's disallowed `/api`, `/gql`, RSS, Atom, or internal Next.js endpoints. As of 2026-11-08, the public page reports zero upcoming events, so zero Meetup rows is expected.

## Data policy

- Respect `robots.txt` and source terms.
- Use public event pages only; never scrape content behind login.
- Keep the external `signup_url` and do not represent Block by Block as the organiser.
- Deterministic IDs make refreshes idempotent. After a validated source refresh, missing active listings are soft-withdrawn with `source_withdrawn_at`; ended or completed events, comments, RSVPs and detail URLs are preserved. Reappearing listings clear the withdrawal timestamp and keep the same identity.
- A source failure or malformed/unrecognized snapshot does not alter that source's previous state or block other adapters, but the command exits non-zero so scheduled jobs can alert.
