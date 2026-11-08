import postgres from 'postgres'

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const required = [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
  ] as const
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) throw new Error(`Missing database settings: ${missing.join(', ')}`)

  const url = new URL('postgresql://localhost')
  url.hostname = process.env.POSTGRES_HOST!
  url.port = process.env.POSTGRES_PORT!
  url.pathname = `/${process.env.POSTGRES_DB!}`
  url.username = process.env.POSTGRES_USER!
  url.password = process.env.POSTGRES_PASSWORD!
  url.searchParams.set('sslmode', process.env.POSTGRES_SSLMODE ?? 'require')
  return url.toString()
}

const sslMode = process.env.POSTGRES_SSLMODE ?? 'require'
const ssl = sslMode === 'disable' ? false : sslMode === 'prefer' ? 'prefer' : 'require'

export const sql = postgres(connectionString(), {
  ssl,
  max: 5,
  connect_timeout: 15,
  idle_timeout: 20,
})
