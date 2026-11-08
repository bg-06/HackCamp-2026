import { createHash } from 'node:crypto'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { allRecords, type JsonObject } from '../lib/opendatasoft.js'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

type Point = { lon: number; lat: number }
type LocalArea = { name: string; geom: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> }
type Org = {
  name: string
  kind: string
  address: string | null
  localArea: string | null
  latitude: number | null
  longitude: number | null
  website: string | null
  sourceKey: string
}
type DatasetConfig = {
  id: string
  kind: string
  map(records: JsonObject[]): Org[]
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function coordinates(record: JsonObject): Point | null {
  const pointValue = record.geo_point_2d
  if (pointValue && typeof pointValue === 'object') {
    const candidate = pointValue as JsonObject
    const lon = number(candidate.lon)
    const lat = number(candidate.lat)
    if (lon !== null && lat !== null) return { lon, lat }
  }
  const longitude = number(record.longitude)
  const latitude = number(record.latitude)
  return longitude !== null && latitude !== null ? { lon: longitude, lat: latitude } : null
}

function semanticKey(datasetId: string, ...parts: unknown[]): string {
  const identity = parts.map((part) => String(part ?? '').trim().toLowerCase()).join('|')
  return createHash('sha256').update(`${datasetId}|${identity}`).digest('hex')
}

function areaFor(pointValue: Point | null, areas: LocalArea[]): string | null {
  if (!pointValue) return null
  const candidate = point([pointValue.lon, pointValue.lat])
  return areas.find((area) => booleanPointInPolygon(candidate, area.geom))?.name ?? null
}

function orgFromRecord(
  datasetId: string,
  kind: string,
  record: JsonObject,
  values: { name: string; address?: string | null; website?: string | null; localArea?: string | null; sourceKey?: string | null },
): Org {
  const location = coordinates(record)
  return {
    name: values.name,
    kind,
    address: values.address ?? null,
    website: values.website ?? null,
    localArea: values.localArea ?? null,
    latitude: location?.lat ?? null,
    longitude: location?.lon ?? null,
    sourceKey: values.sourceKey ?? semanticKey(datasetId, values.name, values.address, location?.lat, location?.lon),
  }
}

const DATASETS: DatasetConfig[] = [
  {
    id: 'community-centres',
    kind: 'community centre',
    map: (records) => records.map((record) => orgFromRecord('community-centres', 'community centre', record, {
      name: text(record.name) ?? 'Unnamed community centre',
      address: text(record.address), website: text(record.urllink), localArea: text(record.geo_local_area),
      sourceKey: text(record.object_id) ?? text(record.name),
    })),
  },
  {
    id: 'business-improvement-areas-bia',
    kind: 'business improvement area',
    map: (records) => records.map((record) => orgFromRecord('business-improvement-areas-bia', 'business improvement area', record, {
      name: text(record.name) ?? 'Unnamed BIA', sourceKey: text(record.mapid),
    })),
  },
  {
    id: 'community-gardens-and-food-trees',
    kind: 'community garden',
    map: (records) => records.map((record) => orgFromRecord('community-gardens-and-food-trees', 'community garden', record, {
      name: text(record.name) ?? 'Unnamed community garden',
      address: text(record.merged_address),
      website: text(record.website) ?? (text(record.public_e_mail) ? `mailto:${text(record.public_e_mail)}` : null),
      localArea: text(record.geo_local_area), sourceKey: text(record.mapid),
    })),
  },
  {
    id: 'free-and-low-cost-food-programs',
    kind: 'food program',
    map: (records) => {
      const grouped = new Map<string, JsonObject[]>()
      for (const record of records) {
        const name = text(record.organization_name) ?? text(record.program_name) ?? 'Unnamed food program'
        const key = semanticKey('free-and-low-cost-food-programs', name)
        grouped.set(key, [...(grouped.get(key) ?? []), record])
      }
      return [...grouped.entries()].map(([sourceKey, group]) => {
        const first = group[0]!
        const email = group.map((record) => text(record.signup_email)).find(Boolean) ?? null
        return orgFromRecord('free-and-low-cost-food-programs', 'food program', first, {
          name: text(first.organization_name) ?? text(first.program_name) ?? 'Unnamed food program',
          address: group.map((record) => text(record.address)).find(Boolean) ?? null,
          website: email ? `mailto:${email}` : null,
          localArea: group.map((record) => text(record.local_area)).find(Boolean) ?? null,
          sourceKey,
        })
      })
    },
  },
  {
    id: 'schools',
    kind: 'school',
    map: (records) => records.map((record) => orgFromRecord('schools', 'school', record, {
      name: text(record.school_name) ?? 'Unnamed school', address: text(record.address),
      localArea: text(record.geo_local_area),
      sourceKey: semanticKey('schools', text(record.school_name), text(record.address)),
    })),
  },
  {
    id: 'libraries',
    kind: 'library',
    map: (records) => records.map((record) => orgFromRecord('libraries', 'library', record, {
      name: text(record.name) ?? 'Unnamed library', address: text(record.address),
      website: text(record.urllink), localArea: text(record.geo_local_area), sourceKey: text(record.name),
    })),
  },
]

async function ensureSchema(): Promise<void> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'source_dataset'
    ) AS exists
  `
  if (!row?.exists) {
    throw new Error('The app orgs schema is missing. Merge/apply Step 5 migration 002_app.sql before running ingest:orgs; db:migrate on this branch only installs ingest tables.')
  }
}

async function upsert(datasetId: string, org: Org): Promise<void> {
  await sql`
    INSERT INTO orgs (name, kind, address, local_area, latitude, longitude, website, source_dataset, source_key)
    VALUES (${org.name}, ${org.kind}, ${org.address}, ${org.localArea}, ${org.latitude}, ${org.longitude},
            ${org.website}, ${datasetId}, ${org.sourceKey})
    ON CONFLICT (source_dataset, source_key) DO UPDATE SET
      name = EXCLUDED.name, kind = EXCLUDED.kind, address = EXCLUDED.address,
      local_area = EXCLUDED.local_area, latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude, website = EXCLUDED.website
  `
}

try {
  await ensureSchema()
  const areas = await sql<LocalArea[]>`SELECT name, geom FROM local_areas`
  for (const dataset of DATASETS) {
    const records = await allRecords(dataset.id)
    const organizations = dataset.map(records).map((org) => ({
      ...org,
      localArea: org.localArea ?? areaFor(
        org.latitude !== null && org.longitude !== null ? { lat: org.latitude, lon: org.longitude } : null,
        areas,
      ),
    }))
    for (const org of organizations) await upsert(dataset.id, org)

    const keys = organizations.map((org) => org.sourceKey)
    if (keys.length) {
      await sql`DELETE FROM orgs WHERE source_dataset = ${dataset.id} AND source_key NOT IN ${sql(keys)}`
    }
    console.log(`${dataset.id}: fetched ${records.length} records, retained ${organizations.length} organizations`)
  }
} finally {
  await sql.end()
}
