import { config } from 'dotenv'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects } from 'hyparquet'
import pg from 'pg'
import { from as copyFrom } from 'pg-copy-streams'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

const COLUMNS = [
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

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const url = new URL('postgresql://localhost')
  url.hostname = process.env.POSTGRES_HOST!
  url.port = process.env.POSTGRES_PORT!
  url.pathname = `/${process.env.POSTGRES_DB!}`
  url.username = process.env.POSTGRES_USER!
  url.password = process.env.POSTGRES_PASSWORD!
  return url.toString()
}

function copyValue(value: unknown): string {
  if (value === null || value === undefined) return '\\N'
  if (value instanceof Date) return value.toISOString()
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('\t', '\\t')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
}

async function main(): Promise<void> {
  const source = resolve(process.argv[2] ?? join(here, '../../../data/raw/3-1-1-service-requests.parquet'))
  const file = await asyncBufferFromFile(source)
  const metadata = await parquetMetadataAsync(file)
  const totalRows = Number(metadata.num_rows)
  const sslMode = process.env.POSTGRES_SSLMODE ?? 'require'
  const client = new pg.Client({
    connectionString: connectionString(),
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE raw_311_requests RESTART IDENTITY')
    const copy = client.query(copyFrom(`COPY raw_311_requests (${COLUMNS.join(', ')}) FROM STDIN`))

    const batchSize = 10_000
    for (let rowStart = 0; rowStart < totalRows; rowStart += batchSize) {
      const rowEnd = Math.min(rowStart + batchSize, totalRows)
      const rows = await parquetReadObjects({ file, columns: [...COLUMNS], rowStart, rowEnd })
      for (const row of rows) {
        const line = COLUMNS.map((column) => copyValue(row[column])).join('\t') + '\n'
        if (!copy.write(line)) await once(copy, 'drain')
      }
      console.log(`raw_311_requests: ${rowEnd}/${totalRows}`)
    }

    copy.end()
    await finished(copy)
    await client.query('COMMIT')
    await sql`
      INSERT INTO ingest_state (dataset_id, last_started_at, last_succeeded_at, last_error, rows_loaded)
      VALUES ('3-1-1-service-requests', now(), now(), NULL, ${totalRows})
      ON CONFLICT (dataset_id) DO UPDATE SET
        last_started_at = now(), last_succeeded_at = now(), last_error = NULL, rows_loaded = ${totalRows}
    `
    console.log(`Historical 311 load complete: ${totalRows} rows`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
    await sql.end()
  }
}

await main()
