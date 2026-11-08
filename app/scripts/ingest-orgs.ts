import { createHash } from 'node:crypto'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

const API_ROOT = 'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets'

type JsonObject = Record<string, unknown>
type Page = { total_count: number; results: JsonObject[] }
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
  map(record: JsonObject): Omit<Org, 'kind' | 'localArea' | 'sourceKey'> & { localArea?: string | null; sourceKey?: string | null }
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

function stableKey(datasetId: string, record: JsonObject, preferred?: string | null): string {
  if (preferred) return preferred
  const identity = JSON.stringify(record, Object.keys(record).sort())
  return createHash('sha256').update(`${datasetId}|${identity}`).digest('hex')
}

async function allRecords(datasetId: string): Promise<JsonObject[]> {
  const output: JsonObject[] = []
  for (let offset = 0; ; offset += 100) {
    const url = new URL(`${API_ROOT}/${datasetId}/records`)
    url.searchParams.set('limit', '100')
    url.searchParams.set('offset', String(offset))
    const response = await fetch(url, {
      headers: { 'user-agent': 'BlockByBlock-Org-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error(`${datasetId}: ${response.status} ${response.statusText}`)
    const page = await response.json() as Page
    output.push(...page.results)
    if (!page.results.length || output.length >= page.total_count) return output
  }
}

function areaFor(pointValue: Point | null, areas: LocalArea[]): string | null {
  if (!pointValue) return null
  const candidate = point([pointValue.lon, pointValue.lat])
  for (const area of areas) {
    if (booleanPointInPolygon(candidate, area.geom)) return area.name
  }
  return null
}

const DATASETS: DatasetConfig[] = [
  {
    id: 'community-centres',
    kind: 'community centre',
    map: (record) => ({
      name: text(record.name) ?? 'Unnamed community centre',
      address: text(record.address),
      website: text(record.urllink),
      ...coordinatesToFields(record),
      localArea: text(record.geo_local_area),
      sourceKey: text(record.object_id) ?? text(record.name),
    }),
  },
  {
    id: 'business-improvement-areas-bia',
    kind: 'business improvement area',
    map: (record) => ({
      name: text(record.name) ?? 'Unnamed BIA',
      address: null,
      website: null,
      ...coordinatesToFields(record),
      sourceKey: text(record.mapid),
    }),
  },
  {
    id: 'community-gardens-and-food-trees',
    kind: 'community garden',
    map: (record) => ({
      name: text(record.steward_or_managing_organization) ?? text(record.name) ?? 'Unnamed community garden',
      address: text(record.merged_address),
      website: text(record.website) ?? (text(record.public_e_mail) ? `mailto:${text(record.public_e_mail)}` : null),
      ...coordinatesToFields(record),
      localArea: text(record.geo_local_area),
      sourceKey: text(record.mapid),
    }),
  },
  {
    id: 'free-and-low-cost-food-programs',
    kind: 'food program',
    map: (record) => ({
      name: text(record.organization_name) ?? text(record.program_name) ?? 'Unnamed food program',
      address: text(record.address),
      website: text(record.signup_email) ? `mailto:${text(record.signup_email)}` : null,
      ...coordinatesToFields(record),
      localArea: text(record.local_area),
      sourceKey: null,
    }),
  },
  {
    id: 'schools',
    kind: 'school',
    map: (record) => ({
      name: text(record.school_name) ?? 'Unnamed school',
      address: text(record.address),
      website: null,
      ...coordinatesToFields(record),
      localArea: text(record.geo_local_area),
      sourceKey: null,
    }),
  },
  {
    id: 'libraries',
    kind: 'library',
    map: (record) => ({
      name: text(record.name) ?? 'Unnamed library',
      address: text(record.address),
      website: text(record.urllink),
      ...coordinatesToFields(record),
      localArea: text(record.geo_local_area),
      sourceKey: text(record.name),
    }),
  },
]

function coordinatesToFields(record: JsonObject): { latitude: number | null; longitude: number | null } {
  const value = coordinates(record)
  return { latitude: value?.lat ?? null, longitude: value?.lon ?? null }
}

async function ensureSchema(): Promise<void> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'source_dataset'
    ) AS exists
  `
  if (!row?.exists) throw new Error('The Step 5 orgs migration is not applied. Run npm --prefix app run db:migrate first.')
}

async function upsert(dataset: DatasetConfig, org: Org): Promise<void> {
  await sql`
    INSERT INTO orgs (
      name, kind, address, local_area, latitude, longitude, website, source_dataset, source_key
    ) VALUES (
      ${org.name}, ${org.kind}, ${org.address}, ${org.localArea}, ${org.latitude}, ${org.longitude},
      ${org.website}, ${dataset.id}, ${org.sourceKey}
    )
    ON CONFLICT (source_dataset, source_key) DO UPDATE SET
      name = EXCLUDED.name,
      kind = EXCLUDED.kind,
      address = EXCLUDED.address,
      local_area = EXCLUDED.local_area,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      website = EXCLUDED.website
  `
}

try {
  await ensureSchema()
  const areaRows = await sql<{ name: string; geom: LocalArea['geom'] }[]>`SELECT name, geom FROM local_areas`
  const areas = areaRows as LocalArea[]

  for (const dataset of DATASETS) {
    const records = await allRecords(dataset.id)
    for (const record of records) {
      const mapped = dataset.map(record)
      const pointValue = mapped.latitude !== null && mapped.longitude !== null
        ? { lat: mapped.latitude, lon: mapped.longitude }
        : null
      const org: Org = {
        ...mapped,
        kind: dataset.kind,
        localArea: mapped.localArea ?? areaFor(pointValue, areas),
        sourceKey: stableKey(dataset.id, record, mapped.sourceKey),
      }
      await upsert(dataset, org)
    }
    console.log(`${dataset.id}: upserted ${records.length} organizations`)
  }
} finally {
  await sql.end()
}
