// Block by Block API: what the React frontend (frontend/src/api/client.ts) calls.
// Run: npm --prefix app run api   (listens on http://localhost:8000; Vite forwards /api/* here)
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '../../../.env') })
const { sql } = await import('../lib/db.js')

// Gold categories (databricks/sql/gold_views.sql) -> the frontend's IssueCategory (frontend/src/types.ts).
// Categories not listed here are left out of the feed.
const ISSUE_CATEGORY: Record<string, string> = {
  'Roads and Sidewalks': 'roads',
  'Graffiti': 'graffiti',
  'Garbage and Dumping': 'garbage',
  'Lighting and Signals': 'lighting',
  'Parks and Trees': 'trees',
  'Water and Sewer': 'water',
}

function eventCategory(kind: string, category: string | null): string {
  if (kind === 'city') return 'city'
  const c = (category ?? '').toLowerCase()
  if (/(litter|dumping|graffiti|garbage|cleanup)/.test(c)) return 'cleanup'
  if (/(garden|tree|park)/.test(c)) return 'garden'
  return 'meetup'
}

// Stable card height per id, so the two-column feed looks staggered.
function cover(id: string): 'short' | 'medium' | 'tall' {
  const sizes = ['short', 'medium', 'tall'] as const
  return sizes[createHash('sha256').update(id).digest()[0]! % 3]!
}

const vanDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' })
const vanTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Vancouver', hour: 'numeric', minute: '2-digit', hour12: true })

// TEMPORARY: who is calling. Replaced by the Auth0 token check in step 9.
function userId(req: Request): string {
  return req.header('x-demo-user') ?? 'demo-user'
}

const app = express()
app.use(express.json())

app.get('/health', async (_req, res) => {
  await sql`SELECT 1`
  res.json({ ok: true })
})

// IssuePost[]: open City-only (Track 2) issues, highest base score first.
app.get('/issues', async (_req, res) => {
  const rows = await sql<{
    issue_id: string; request_type: string; category: string | null; address: string | null
    local_area: string | null; days_open: number | null; me_too: number
  }[]>`
    SELECT i.issue_id, i.request_type, i.category, i.address, i.local_area, i.days_open,
           count(v.issue_id) FILTER (WHERE v.value = 1)::int AS me_too
    FROM gold_track2_issues i
    LEFT JOIN votes v ON v.issue_id = i.issue_id
    GROUP BY i.issue_id
    ORDER BY i.base_score DESC NULLS LAST
    LIMIT 200`
  res.json(
    rows
      .filter((r) => r.category !== null && r.category in ISSUE_CATEGORY)
      .map((r) => ({
        kind: 'issue',
        id: r.issue_id,
        title: r.request_type.replace(/\s+(Case|Request)$/, ''),
        category: ISSUE_CATEGORY[r.category!],
        location: r.address ?? 'Location not given',
        area: r.local_area ?? 'Vancouver',
        daysOpen: r.days_open ?? 0,
        meToo: r.me_too,
        cover: cover(r.issue_id),
      })),
  )
})

// EventPost[]: upcoming events, soonest first.
app.get('/events', async (_req, res) => {
  const rows = await sql<{
    id: string; kind: string; title: string | null; category: string | null; location: string | null
    local_area: string | null; starts_at: Date; going: number
  }[]>`
    SELECT e.id, e.kind, e.title, e.category, e.location, e.local_area, e.starts_at,
           count(r.event_id)::int AS going
    FROM events e
    LEFT JOIN rsvps r ON r.event_id = e.id
    WHERE e.starts_at >= now() - interval '1 day'
    GROUP BY e.id
    ORDER BY e.starts_at
    LIMIT 200`
  res.json(
    rows.map((r) => ({
      kind: 'event',
      id: r.id,
      title: r.title ?? 'Untitled event',
      category: eventCategory(r.kind, r.category),
      location: r.location ?? 'Location to be announced',
      area: r.local_area ?? 'Vancouver',
      date: vanDate.format(r.starts_at),
      time: vanTime.format(r.starts_at).toLowerCase(),
      going: r.going,
      cover: cover(r.id),
    })),
  )
})

// "Me too" = an up-vote on a Track 2 issue. One per user per issue.
app.post('/issues/:id/me-too', async (req, res) => {
  await sql`
    INSERT INTO votes (issue_id, user_id, value) VALUES (${req.params.id}, ${userId(req)}, 1)
    ON CONFLICT (issue_id, user_id) DO UPDATE SET value = 1`
  res.status(204).end()
})

app.delete('/issues/:id/me-too', async (req, res) => {
  await sql`DELETE FROM votes WHERE issue_id = ${req.params.id} AND user_id = ${userId(req)}`
  res.status(204).end()
})

app.post('/events/:id/going', async (req, res) => {
  const found = await sql`SELECT 1 FROM events WHERE id = ${req.params.id}`
  if (found.length === 0) {
    res.status(404).json({ error: 'event not found' })
    return
  }
  await sql`
    INSERT INTO rsvps (event_id, user_id) VALUES (${req.params.id}, ${userId(req)})
    ON CONFLICT DO NOTHING`
  res.status(204).end()
})

app.delete('/events/:id/going', async (req, res) => {
  await sql`DELETE FROM rsvps WHERE event_id = ${req.params.id} AND user_id = ${userId(req)}`
  res.status(204).end()
})

// Errors come back as JSON, never as an HTML stack trace.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'internal error' })
})

const port = Number(process.env.PORT ?? 8000)
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
