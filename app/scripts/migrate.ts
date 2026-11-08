// Runs every app/db/migrations/*.sql file once, in filename order.
// Applied files are recorded in schema_migrations, so running this again only applies new files.
//
//   npm --prefix app run db:migrate                                   apply new files
//   npm --prefix app run db:migrate -- --mark-applied 001_ingest.sql  record a file as applied
//                                                                     without running it (for a file
//                                                                     already applied by hand)
import { config } from 'dotenv'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

const dir = join(here, '../../db/migrations')
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`
  const markIndex = process.argv.indexOf('--mark-applied')
  if (markIndex !== -1) {
    const file = process.argv[markIndex + 1]
    if (!file || !files.includes(file)) throw new Error(`--mark-applied needs one of: ${files.join(', ')}`)
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`
    console.log(`marked  ${file} as applied (not run)`)
    process.exit(0)
  }

  const rows = await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`
  const applied = new Set(rows.map((r) => r.filename))

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file} (already applied)`)
      continue
    }
    const text = await readFile(join(dir, file), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(text)
      await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`
    })
    console.log(`applied ${file}`)
  }
  console.log('Database migration complete')
} finally {
  await sql.end()
}
