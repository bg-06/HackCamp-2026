import { createHash } from 'node:crypto'
import { latLngToCell } from 'h3-js'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadVolunteerImage, type DownloadedImage } from '../lib/volunteer-sources/image-download.js'
import { retiredVolunteerSourceIds, volunteerSources, type VolunteerListing } from '../lib/volunteer-sources/index.js'
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
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'source_withdrawn_at'
    ) AS exists
  `
  if (!row?.exists) {
    throw new Error('The external event schema is missing. Apply migrations 002_app.sql and 005_event_source_withdrawal.sql before normalized event ingest.')
  }
}

type QueryTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>

async function upsertImage(tx: QueryTag, eventId: string, listing: VolunteerListing, image: DownloadedImage): Promise<void> {
  await tx`
    INSERT INTO event_images (event_id, data, mime_type, source_url, attribution, license)
    VALUES (
      ${eventId}, ${Buffer.from(image.data)}, ${image.mimeType}, ${listing.imageSourceUrl},
      ${listing.imageAttribution ?? null}, ${listing.imageLicense ?? null}
    )
    ON CONFLICT (event_id) DO UPDATE SET
      data = EXCLUDED.data,
      mime_type = EXCLUDED.mime_type,
      source_url = EXCLUDED.source_url,
      attribution = EXCLUDED.attribution,
      license = EXCLUDED.license,
      updated_at = now()
  `
}

async function upsert(tx: QueryTag, listing: VolunteerListing, image?: DownloadedImage): Promise<string> {
  const id = listingId(listing)
  await tx`
    INSERT INTO events (
      id, kind, title, organiser, category, starts_at, ends_at, location, local_area,
      latitude, longitude, h3_r9, spots_total, what_to_bring, signup_url, is_sample, created_by
    ) VALUES (
      ${id}, ${listing.kind}, ${listing.title}, ${listing.organiser},
      ${listing.category}, ${listing.startsAt}, ${listing.endsAt}, ${listing.location},
      ${listing.localArea}, ${listing.latitude}, ${listing.longitude}, ${listing.latitude !== null && listing.longitude !== null ? latLngToCell(listing.latitude, listing.longitude, 9) : null}, ${listing.spotsTotal},
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
      latitude = COALESCE(EXCLUDED.latitude, CASE WHEN events.location = EXCLUDED.location THEN events.latitude END),
      longitude = COALESCE(EXCLUDED.longitude, CASE WHEN events.location = EXCLUDED.location THEN events.longitude END),
      h3_r9 = COALESCE(EXCLUDED.h3_r9, CASE WHEN events.location = EXCLUDED.location THEN events.h3_r9 END),
      spots_total = EXCLUDED.spots_total,
      what_to_bring = EXCLUDED.what_to_bring,
      signup_url = EXCLUDED.signup_url,
      is_sample = false,
      created_by = EXCLUDED.created_by,
      source_withdrawn_at = NULL
  `
  if (image) await upsertImage(tx, id, listing, image)
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
  for (const sourceId of retiredVolunteerSourceIds) {
    const result = await sql`
      UPDATE events
      SET source_withdrawn_at = now()
      WHERE created_by = ${`source:${sourceId}`} AND source_withdrawn_at IS NULL AND done_at IS NULL`
    console.log(`${sourceId}: retired ${result.count} listings`)
  }
  for (const source of volunteerSources()) {
    try {
      const snapshot = await source.fetchListings()
      if (!snapshot.validated) throw new Error(`${source.id}: source snapshot was not validated`)
      await sql.begin(async (tx) => {
        const ids: string[] = []
        for (const listing of snapshot.listings) {
          let image: DownloadedImage | undefined
          if (listing.imageSourceUrl) {
            try {
              image = await downloadVolunteerImage(listing.imageSourceUrl)
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(`${source.id}:${listing.sourceKey}: image fetch failed: ${message}`)
            }
          }
          ids.push(await upsert(tx as unknown as QueryTag, listing, image))
          if (source.id === 'meetup-lower-mainland-green-team') {
            await tx`INSERT INTO raw_volunteer_events
              (source, source_key, record_type, title, organiser, starts_at, ends_at, location, category, signup_url, source_url, raw_record, fetched_at)
              VALUES (${listing.source}, ${listing.sourceKey}, 'upcoming_event', ${listing.title}, ${listing.organiser}, ${listing.startsAt}, ${listing.endsAt}, ${listing.location}, ${listing.category}, ${listing.signupUrl}, ${listing.signupUrl}, ${sql.json(listing as never)}, now())
              ON CONFLICT (source, source_key) DO UPDATE SET title = EXCLUDED.title, organiser = EXCLUDED.organiser,
                starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, location = EXCLUDED.location,
                category = EXCLUDED.category, signup_url = EXCLUDED.signup_url, source_url = EXCLUDED.source_url,
                raw_record = EXCLUDED.raw_record, fetched_at = now()`
          }
        }
        const owner = `source:${source.id}`
        const activeMissing = sql`
          created_by = ${owner}
          AND source_withdrawn_at IS NULL
          AND done_at IS NULL
          AND (
            COALESCE(ends_at, starts_at) >= now()
            OR (starts_at IS NULL AND ends_at IS NULL AND kind IN ('city', 'org') AND signup_url IS NOT NULL)
          )
        `
        if (snapshot.allowWithdrawal === false) return
        if (ids.length) {
          await tx`UPDATE events SET source_withdrawn_at = now() WHERE ${activeMissing} AND id NOT IN ${sql(ids)}`
        } else {
          await tx`UPDATE events SET source_withdrawn_at = now() WHERE ${activeMissing}`
        }
      })
      console.log(`${source.id}: upserted ${snapshot.listings.length} listings`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${source.id}: ${message}`)
      process.exitCode = 1
    }
  }
} finally {
  await sql.end()
}
