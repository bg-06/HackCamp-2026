// Loads volunteer events from data/seed/ into the events table.
// Uses volunteer_events.json if it exists, otherwise volunteer_events.sample.json.
// Safe to run again: rows are upserted by id.
import { config } from 'dotenv'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

type SeedEvent = {
  id: string
  kind: 'city' | 'org' | 'hotspot'
  title: string
  organiser?: string
  category?: string
  startsAt: string
  endsAt?: string
  location?: string
  localArea?: string
  spotsTotal?: number
  whatToBring?: string
  signupUrl?: string
  sample?: boolean
}

const seedDir = join(here, '../../../data/seed')
const real = join(seedDir, 'volunteer_events.json')
const file = await access(real).then(() => real, () => join(seedDir, 'volunteer_events.sample.json'))
const events = JSON.parse(await readFile(file, 'utf8')) as SeedEvent[]

try {
  const [schema] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'signup_url'
    ) AS exists
  `
  if (!schema?.exists) {
    throw new Error('The app events schema is missing. Merge/apply Step 5 migration 002_app.sql before running db:seed-events; db:migrate on this branch only installs ingest tables.')
  }
  for (const e of events) {
    await sql`
      INSERT INTO events (id, kind, title, organiser, category, starts_at, ends_at, location, local_area,
                          spots_total, what_to_bring, signup_url, is_sample)
      VALUES (${e.id}, ${e.kind}, ${e.title}, ${e.organiser ?? null}, ${e.category ?? null}, ${e.startsAt},
              ${e.endsAt ?? null}, ${e.location ?? null}, ${e.localArea ?? null}, ${e.spotsTotal ?? null},
              ${e.whatToBring ?? null}, ${e.signupUrl ?? null}, ${e.sample ?? false})
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind, title = EXCLUDED.title, organiser = EXCLUDED.organiser,
        category = EXCLUDED.category, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
        location = EXCLUDED.location, local_area = EXCLUDED.local_area, spots_total = EXCLUDED.spots_total,
        what_to_bring = EXCLUDED.what_to_bring, signup_url = EXCLUDED.signup_url, is_sample = EXCLUDED.is_sample
    `
  }
  console.log(`Seeded ${events.length} events from ${file}`)
} finally {
  await sql.end()
}
