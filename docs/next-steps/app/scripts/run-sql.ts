// Runs one SQL file (path relative to app/) in a single transaction.
//   npm --prefix app run db:fixtures      (runs db/dev/gold_fixtures.sql)
import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

const rel = process.argv[2]
if (!rel) throw new Error('Usage: node dist/scripts/run-sql.js <file relative to app/>')
const text = await readFile(join(here, '../..', rel), 'utf8')

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(text)
  })
  console.log(`Ran ${rel}`)
} finally {
  await sql.end()
}
