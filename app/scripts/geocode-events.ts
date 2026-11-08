import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { latLngToCell } from 'h3-js'
import { geocodableAddress, geocodeAddress } from '../lib/volunteer-sources/geocode.js'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') })
const { sql } = await import('../lib/db.js')
try {
  const rows = await sql<{ id: string; location: string }[]>`
    SELECT id, location FROM events WHERE latitude IS NULL AND longitude IS NULL
      AND location IS NOT NULL AND source_withdrawn_at IS NULL AND done_at IS NULL
      AND (starts_at IS NULL OR COALESCE(ends_at, starts_at) >= now())`
  const results = new Map<string, Awaited<ReturnType<typeof geocodeAddress>>>()
  let updated = 0
  for (const row of rows) {
    const address = geocodableAddress(row.location)
    if (!address) continue
    if (!results.has(address)) {
      const [cached] = await sql<{ latitude: number; longitude: number; matched_address: string; precision: string; score: number }[]>`
        SELECT latitude, longitude, matched_address, precision, score FROM event_geocodes WHERE address = ${address}`
      const result = cached ? { latitude: cached.latitude, longitude: cached.longitude, matchedAddress: cached.matched_address, precision: cached.precision, score: cached.score } : await geocodeAddress(address)
      if (result && !cached) await sql`INSERT INTO event_geocodes (address, latitude, longitude, matched_address, precision, score)
        VALUES (${address}, ${result.latitude}, ${result.longitude}, ${result.matchedAddress}, ${result.precision}, ${result.score}) ON CONFLICT (address) DO NOTHING`
      results.set(address, result)
    }
    const point = results.get(address)
    if (!point) continue
    const result = await sql`UPDATE events SET latitude = ${point.latitude}, longitude = ${point.longitude}, h3_r9 = ${latLngToCell(point.latitude, point.longitude, 9)}
      WHERE id = ${row.id} AND location = ${row.location} AND latitude IS NULL AND longitude IS NULL`
    updated += result.count
  }
  console.log(`Geocoded ${updated} events from ${results.size} distinct addresses`)
} finally { await sql.end() }
