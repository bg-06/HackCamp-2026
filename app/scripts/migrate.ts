import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')
const migration = await readFile(join(here, '../../db/migrations/001_ingest.sql'), 'utf8')

try {
  await sql.unsafe(migration)
  console.log('Database migration complete')
} finally {
  await sql.end()
}
