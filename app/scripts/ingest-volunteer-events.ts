import { createHash } from 'node:crypto'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { volunteerSources, type VolunteerListing } from '../lib/volunteer-sources/index.js'
import { GreenTeamsActivitiesAdapter, type RawVolunteerRecord } from '../lib/volunteer-sources/green-teams.js'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

function listingId(listing: VolunteerListing): string {
  return `external-${createHash('sha256').update(`${listing.source}|${listing.sourceKey}`).digest('hex').slice(0, 24)}`
}

async function ensureRawTable(): Promise<void> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT to_regclass('public.raw_volunteer_events') IS NOT NULL AS exists
  `
  if (!row?.exists) {
    throw new Error('raw_volunteer_events is missing. Apply app/db/migrations/004_volunteer_raw.sql before running this command.')
  }
}

async function upsertRaw(record: RawVolunteerRecord): Promise<void> {
  await sql`
    INSERT INTO raw_volunteer_events (
      source, source_key, record_type, title, organiser, starts_at, ends_at, location,
      municipality, category, signup_url, source_url, published_at, raw_record, fetched_at
    ) VALUES (
      ${record.source}, ${record.sourceKey}, ${record.recordType}, ${record.title}, ${record.organiser},
      ${record.startsAt}, ${record.endsAt}, ${record.location}, ${record.municipality}, ${record.category},
      ${record.signupUrl}, ${record.sourceUrl}, ${record.publishedAt}, ${sql.json(record.rawRecord as never)}, now()
    )
    ON CONFLICT (source, source_key) DO UPDATE SET
      record_type = EXCLUDED.record_type,
      title = EXCLUDED.title,
      organiser = EXCLUDED.organiser,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      location = EXCLUDED.location,
      municipality = EXCLUDED.municipality,
      category = EXCLUDED.category,
      signup_url = EXCLUDED.signup_url,
      source_url = EXCLUDED.source_url,
      published_at = EXCLUDED.published_at,
      raw_record = EXCLUDED.raw_record,
      fetched_at = now()
  `
}

async function ensureAppSchema(): Promise<void> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'signup_url'
    ) AS exists
  `
  if (!row?.exists) {
    throw new Error('The app events schema is missing. Merge/apply Step 5 migration 002_app.sql before normalized event ingest; db:migrate on this branch only installs ingest tables.')
  }
}

async function upsert(listing: VolunteerListing): Promise<string> {
  const id = listingId(listing)
  await sql`
    INSERT INTO events (
      id, kind, title, organiser, category, starts_at, ends_at, location, local_area,
      latitude, longitude, spots_total, what_to_bring, signup_url, is_sample, created_by
    ) VALUES (
      ${id}, ${listing.kind}, ${listing.title}, ${listing.organiser},
      ${listing.category}, ${listing.startsAt}, ${listing.endsAt}, ${listing.location},
      ${listing.localArea}, ${listing.latitude}, ${listing.longitude}, ${listing.spotsTotal},
      ${listing.whatToBring}, ${listing.signupUrl}, false, ${`source:${listing.source}`}
    )
    ON CONFLICT (id) DO UPDATE SET
      kind = EXCLUDED.kind,
      title = EXCLUDED.title,
      organiser = EXCLUDED.organiser,
      category = EXCLUDED.category,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      location = EXCLUDED.location,
      local_area = EXCLUDED.local_area,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      spots_total = EXCLUDED.spots_total,
      what_to_bring = EXCLUDED.what_to_bring,
      signup_url = EXCLUDED.signup_url,
      is_sample = false,
      created_by = EXCLUDED.created_by
  `
  return id
}

try {
  await ensureRawTable()
  const greenTeams = new GreenTeamsActivitiesAdapter()
  try {
    const rawRecords = await greenTeams.fetchRecords()
    for (const record of rawRecords) await upsertRaw(record)
    const keys = rawRecords.map((record) => record.sourceKey)
    if (keys.length) {
      await sql`DELETE FROM raw_volunteer_events WHERE source = ${greenTeams.id} AND source_key NOT IN ${sql(keys)}`
    }
    console.log(`${greenTeams.id}: upserted ${rawRecords.length} raw records`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${greenTeams.id}: ${message}`)
    process.exitCode = 1
  }

  await ensureAppSchema()
  for (const source of volunteerSources) {
    try {
      const listings = await source.fetchListings()
      const ids: string[] = []
      for (const listing of listings) ids.push(await upsert(listing))
      if (ids.length) {
        await sql`DELETE FROM events WHERE created_by = ${`source:${source.id}`} AND id NOT IN ${sql(ids)}`
      } else {
        await sql`DELETE FROM events WHERE created_by = ${`source:${source.id}`}`
      }
      console.log(`${source.id}: upserted ${listings.length} listings`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${source.id}: ${message}`)
      process.exitCode = 1
    }
  }
} finally {
  await sql.end()
}
