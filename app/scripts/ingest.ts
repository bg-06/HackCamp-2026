import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }
type ApiPage = { total_count: number; results: JsonObject[] }
type DatasetMetadata = { metas?: { default?: { data_processed?: string } } }

const API_ROOT = 'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets'
const DATASET_311 = '3-1-1-service-requests'
const PAGE_SIZE = 100

const ROAD_DATASETS = {
  'road-ahead-projects-under-construction': 'under_construction',
  'road-ahead-upcoming-projects': 'upcoming',
} as const

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function hash(...values: unknown[]): string {
  return createHash('sha256').update(values.map(canonical).join('|')).digest('hex')
}

async function apiJson<T>(
  url: string,
  params: Record<string, string | number> = {},
  timeoutMs = 120_000,
): Promise<T> {
  const target = new URL(url)
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value))

  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(target, {
        headers: { 'user-agent': 'BlockByBlock-Ingest/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${target}`)
      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1_000))
    }
  }
  throw lastError
}

async function recordPage(datasetId: string, offset: number, where?: string): Promise<ApiPage> {
  return apiJson<ApiPage>(`${API_ROOT}/${datasetId}/records`, {
    limit: PAGE_SIZE,
    offset,
    ...(where ? { where } : {}),
  })
}

async function allRecords(datasetId: string, where?: string): Promise<JsonObject[]> {
  const output: JsonObject[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await recordPage(datasetId, offset, where)
    output.push(...page.results)
    if (!page.results.length || output.length >= page.total_count) return output
  }
}


async function sourceProcessedAt(datasetId: string): Promise<string | null> {
  const metadata = await apiJson<DatasetMetadata>(`${API_ROOT}/${datasetId}`)
  return metadata.metas?.default?.data_processed ?? null
}

async function markStarted(datasetId: string): Promise<void> {
  await sql`
    INSERT INTO ingest_state (dataset_id, last_started_at, last_error)
    VALUES (${datasetId}, now(), NULL)
    ON CONFLICT (dataset_id) DO UPDATE
    SET last_started_at = now(), last_error = NULL
  `
}

async function runDataset(datasetId: string, work: () => Promise<number>): Promise<void> {
  await markStarted(datasetId)
  try {
    const rows = await work()
    await sql`
      UPDATE ingest_state SET
        last_succeeded_at = now(),
        last_error = NULL,
        rows_loaded = ${rows},
        source_processed_at = ${await sourceProcessedAt(datasetId)}
      WHERE dataset_id = ${datasetId}
    `
    console.log(`${datasetId}: loaded ${rows} rows`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await sql`UPDATE ingest_state SET last_error = ${message} WHERE dataset_id = ${datasetId}`
    throw error
  }
}

async function ingest311(): Promise<void> {
  await runDataset(DATASET_311, async () => {
    const [state] = await sql<{ newest: Date | null }[]>`
      SELECT max(last_modified_timestamp) AS newest FROM raw_311_requests
    `
    const since = state?.newest ?? null
    if (!since) {
      throw new Error('No 311 history loaded. Run npm --prefix app run ingest:history first.')
    }

    const columns = [
      'department',
      'service_request_type',
      'status',
      'closure_reason',
      'service_request_open_timestamp',
      'service_request_close_date',
      'last_modified_timestamp',
      'address',
      'local_area',
      'channel',
      'latitude',
      'longitude',
    ] as const

    let loaded = 0
    const end = new Date()
    let windowStart = since

    while (windowStart < end) {
      const windowEnd = new Date(Math.min(windowStart.getTime() + 24 * 60 * 60 * 1_000, end.getTime()))
      const where = `last_modified_timestamp > date'${windowStart.toISOString()}' and last_modified_timestamp <= date'${windowEnd.toISOString()}'`
      const records = await allRecords(DATASET_311, where)
      for (let batchStart = 0; batchStart < records.length; batchStart += 2_000) {
        const batch = records.slice(batchStart, batchStart + 2_000).map((record) => ({
        department: record.department,
        service_request_type: record.service_request_type,
        status: record.status,
        closure_reason: record.closure_reason,
        service_request_open_timestamp: record.service_request_open_timestamp,
        service_request_close_date: record.service_request_close_date,
        last_modified_timestamp: record.last_modified_timestamp,
        address: record.address,
        local_area: record.local_area,
        channel: record.channel,
        latitude: record.latitude,
        longitude: record.longitude,
        }))
        await sql`INSERT INTO raw_311_requests ${sql(batch, ...columns)}`
        loaded += batch.length
      }
      console.log(`${DATASET_311}: ${windowStart.toISOString()}–${windowEnd.toISOString()} (${records.length}), total ${loaded}`)
      windowStart = windowEnd
    }

    return loaded
  })
}

async function ingestRoadDataset(datasetId: keyof typeof ROAD_DATASETS): Promise<void> {
  await runDataset(datasetId, async () => {
    const records = await allRecords(datasetId)
    await sql.begin(async (tx) => {
      await tx`CREATE TEMP TABLE road_projects_stage (LIKE road_projects INCLUDING DEFAULTS) ON COMMIT DROP`
      for (const record of records) {
        const geometry = record.geom ? JSON.stringify(record.geom) : null
        const point = record.geo_point_2d ? JSON.stringify(record.geo_point_2d) : null
        await tx`
          INSERT INTO road_projects_stage (
            source_key, dataset_id, project_status, project, street, location,
            completion_date, url_link, geom, representative_point, source_record
          ) VALUES (
            ${hash(datasetId, record)}, ${datasetId}, ${ROAD_DATASETS[datasetId]},
            ${record.project as string | null}, ${record.street as string | null},
            ${record.location as string | null}, ${record.comp_date as string | null},
            ${record.url_link as string | null},
            ${geometry}::jsonb,
            ${point}::jsonb,
            ${sql.json(record)}
          )
        `
      }
      await tx`DELETE FROM road_projects WHERE dataset_id = ${datasetId}`
      await tx`INSERT INTO road_projects SELECT * FROM road_projects_stage`
    })
    return records.length
  })
}

async function ingestLocalAreas(): Promise<void> {
  const datasetId = 'local-area-boundary'
  await runDataset(datasetId, async () => {
    const records = await allRecords(datasetId)
    await sql.begin(async (tx) => {
      await tx`CREATE TEMP TABLE local_areas_stage (LIKE local_areas INCLUDING DEFAULTS) ON COMMIT DROP`
      for (const record of records) {
        const geometry = JSON.stringify(record.geom)
        const point = record.geo_point_2d ? JSON.stringify(record.geo_point_2d) : null
        await tx`
          INSERT INTO local_areas_stage (name, geom, representative_point, source_record)
          VALUES (
            ${String(record.name)},
            ${geometry}::jsonb,
            ${point}::jsonb,
            ${sql.json(record)}
          )
        `
      }
      await tx`TRUNCATE local_areas`
      await tx`INSERT INTO local_areas SELECT * FROM local_areas_stage`
    })
    return records.length
  })
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'refresh'
  if (process.argv.includes('--full')) {
    throw new Error('Historical API ingest was removed. Run npm --prefix app run ingest:history instead.')
  }

  if (command === 'status') {
    console.log(await sql`SELECT * FROM ingest_state ORDER BY dataset_id`)
    return
  }
  if (command === 'refresh' || command === 'refresh-static') {
    await ingestLocalAreas()
    for (const datasetId of Object.keys(ROAD_DATASETS) as (keyof typeof ROAD_DATASETS)[]) {
      await ingestRoadDataset(datasetId)
    }
  }
  if (command === 'refresh' || command === 'refresh-311') await ingest311()
  if (!['refresh', 'refresh-static', 'refresh-311', 'status'].includes(command)) {
    throw new Error(`Unknown command: ${command}`)
  }
}

try {
  await main()
} finally {
  await sql.end()
}
