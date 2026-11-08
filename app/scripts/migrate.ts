import { config } from 'dotenv'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')
const migrationsDir = join(here, '../../db/migrations')

try {
  const migrations = (await readdir(migrationsDir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()
  for (const name of migrations) {
    await sql.unsafe(await readFile(join(migrationsDir, name), 'utf8'))
    console.log(`Applied ${name}`)
  }
  console.log(`Database migration complete (${migrations.length} files)`)
} finally {
  await sql.end()
}
