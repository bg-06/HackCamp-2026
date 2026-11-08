// Block by Block API: what the React frontend calls (frontend/src/api/client.ts).
// Response shapes match frontend/src/types.ts: VolunteerEvent, Track2Issue, Comment.
// Run: npm --prefix app run api   (http://localhost:8000; Vite forwards /api/* here)
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import { cellToLatLng, isValidCell } from 'h3-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: [join(root, '.env'), join(root, 'env')] })
const { sql } = await import('../lib/db.js')

// TEMPORARY: who is calling. Replaced by the Auth0 token check (guide step 10).
function userId(req: Request): string {
  return req.header('x-demo-user') ?? 'demo-user'
}

function centre(h3: string | null): { lat?: number; lng?: number } {
  if (!h3 || !isValidCell(h3)) return {}
  const [lat, lng] = cellToLatLng(h3)
  return { lat, lng }
}

const iso = (d: Date | null) => (d ? d.toISOString() : undefined)

// ---------- Track 1: volunteer events ----------

type EventRow = {
  id: string; kind: string; title: string | null; organiser: string | null; category: string | null
  starts_at: Date | null; ends_at: Date | null; location: string | null; local_area: string | null
  spots_total: number | null; what_to_bring: string | null; signup_url: string | null
  is_sample: boolean; latitude: number | null; longitude: number | null; h3_r9: string | null
  created_at: Date; source_withdrawn_at: Date | null; spots_taken: number; going: boolean
  has_image: boolean; comment_count: number
  hotspot_id: string | null
  hs_request_type: string | null; hs_times_reported: number | null; hs_months_seen: number | null
}

// spots_taken leaves out the caller's own RSVP; that is `going` (see types.ts).
function eventQuery(user: string, where: ReturnType<typeof sql>) {
  return sql<EventRow[]>`
    SELECT e.id, e.kind, e.title, e.organiser, e.category, e.starts_at, e.ends_at, e.location,
           e.local_area, e.spots_total, e.what_to_bring, e.signup_url, e.is_sample,
           e.latitude, e.longitude, e.h3_r9, e.created_at, e.source_withdrawn_at, e.hotspot_id,
           count(DISTINCT r.user_id) FILTER (WHERE r.user_id <> ${user})::int AS spots_taken,
           coalesce(bool_or(r.user_id = ${user}), false) AS going,
           coalesce(bool_or(i.event_id IS NOT NULL), false) AS has_image,
           count(DISTINCT c.id) FILTER (WHERE NOT c.hidden)::int AS comment_count,
           h.request_type AS hs_request_type, h.times_reported::int AS hs_times_reported,
           h.months_seen::int AS hs_months_seen
    FROM events e
    LEFT JOIN rsvps r ON r.event_id = e.id
    LEFT JOIN event_images i ON i.event_id = e.id
    LEFT JOIN comments c ON c.event_id = e.id
    -- hotspot_id is "<h3_r9>|<request_type>" for events started from a help hotspot
    LEFT JOIN gold_help_hotspots h ON e.hotspot_id = h.h3_r9 || '|' || h.request_type
    WHERE ${where}
    GROUP BY e.id, h.h3_r9, h.request_type
    ORDER BY e.starts_at NULLS LAST, e.id`
}

function toEvent(r: EventRow) {
  const inApp = r.spots_total !== null
  const place = r.latitude !== null && r.longitude !== null ? { lat: r.latitude, lng: r.longitude } : centre(r.h3_r9)
  return {
    id: r.id,
    kind: r.kind,
    title: r.title ?? 'Untitled event',
    organiser: r.organiser ?? 'Unknown organiser',
    category: r.category ?? 'Other',
    startsAt: r.starts_at?.toISOString() ?? null,
    endsAt: (r.ends_at ?? r.starts_at)?.toISOString() ?? null,
    location: r.location ?? 'Location to be announced',
    localArea: r.local_area ?? 'Vancouver',
    ...(inApp ? { spotsTotal: r.spots_total!, spotsTaken: r.spots_taken } : {}),
    ...(r.what_to_bring ? { whatToBring: r.what_to_bring } : {}),
    ...(r.signup_url ? { signupUrl: r.signup_url } : {}),
    ...(r.has_image ? { photoUrl: `/events/${encodeURIComponent(r.id)}/image` } : {}),
    ...(r.hs_request_type
      ? { hotspot: { requestType: r.hs_request_type, timesReported: r.hs_times_reported ?? 0, monthsSeen: r.hs_months_seen ?? 0 } }
      : {}),
    sample: r.is_sample,
    ...place,
    createdAt: iso(r.created_at),
    going: r.going,
    commentCount: r.comment_count,
    ...(r.hotspot_id ? { hotspotId: r.hotspot_id } : {}),
    withdrawn: r.source_withdrawn_at !== null,
  }
}

// ---------- Track 2: City-only issues ----------

type IssueRow = {
  issue_id: string; h3_r9: string; request_type: string; category: string | null; local_area: string | null
  address: string | null; open_cases: number; days_open: number; times_reported_12m: number; base_score: number
  up_votes: number; down_votes: number; my_vote: number; comment_count: number
}

// up_votes / down_votes leave out the caller's own vote; that is my_vote (see types.ts).
function issueQuery(user: string, where: ReturnType<typeof sql>, limit: number) {
  return sql<IssueRow[]>`
    SELECT i.issue_id, i.h3_r9, i.request_type, i.category, i.local_area, i.address,
           i.open_cases::int, i.days_open::int, i.times_reported_12m::int, i.base_score::float8 AS base_score,
           count(*) FILTER (WHERE v.value = 1 AND v.user_id IS DISTINCT FROM ${user})::int AS up_votes,
           count(*) FILTER (WHERE v.value = -1 AND v.user_id IS DISTINCT FROM ${user})::int AS down_votes,
           coalesce(max(v.value) FILTER (WHERE v.user_id = ${user}), 0)::int AS my_vote,
           count(DISTINCT c.id) FILTER (WHERE NOT c.hidden)::int AS comment_count
    FROM gold_track2_issues i
    LEFT JOIN votes v ON v.issue_id = i.issue_id
    LEFT JOIN comments c ON c.issue_id = i.issue_id
    WHERE ${where}
    GROUP BY i.issue_id
    ORDER BY i.base_score DESC NULLS LAST
    LIMIT ${limit}`
}

function toIssue(r: IssueRow) {
  return {
    issue_id: r.issue_id,
    h3_r9: r.h3_r9,
    request_type: r.request_type,
    category: r.category ?? 'Other',
    local_area: r.local_area ?? 'Vancouver',
    address: r.address,
    open_cases: r.open_cases,
    days_open: r.days_open,
    times_reported_12m: r.times_reported_12m,
    base_score: r.base_score,
    up_votes: r.up_votes,
    down_votes: r.down_votes,
    my_vote: r.my_vote,
    comment_count: r.comment_count,
    ...centre(r.h3_r9),
  }
}

// ---------- Comments ----------

type CommentRow = { id: string; event_id: string | null; issue_id: string | null; user_id: string; body: string; created_at: Date }

function toComment(r: CommentRow) {
  return {
    id: String(r.id),
    targetType: r.event_id ? 'event' : 'issue',
    targetId: r.event_id ?? r.issue_id,
    body: r.body,
    author: r.user_id, // TEMPORARY: a display name once Auth0 gives us one
    authorKind: 'resident',
    createdAt: r.created_at.toISOString(),
  }
}

// ---------- Routes ----------

const app = express()
app.use(express.json())

app.get('/health', async (_req, res) => {
  await sql`SELECT 1`
  res.json({ ok: true })
})

// Active upcoming dated events plus supported ongoing external opportunities.
app.get('/events', async (req, res) => {
  const rows = await eventQuery(userId(req), sql`
    e.source_withdrawn_at IS NULL AND e.done_at IS NULL AND (
      e.starts_at >= now() - interval '1 day'
      OR (e.starts_at IS NULL AND e.ends_at IS NULL AND e.kind IN ('city', 'org') AND e.signup_url IS NOT NULL)
    )
  `)
  res.json(rows.map(toEvent))
})

type EventImageRow = { data: Buffer; mime_type: string; byte_length: number; etag: string }

app.get('/events/:id/image', async (req, res) => {
  const [image] = await sql<EventImageRow[]>`
    SELECT data, mime_type, byte_length,
           '"' || encode(sha256(data), 'hex') || '"' AS etag
    FROM event_images
    WHERE event_id = ${req.params.id}`
  if (!image) return void res.status(404).json({ error: 'event image not found' })

  res.set({
    'Content-Type': image.mime_type,
    'Content-Length': String(image.byte_length),
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    ETag: image.etag,
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.fresh) return void res.status(304).end()
  res.end(image.data)
})

app.get('/events/:id', async (req, res) => {
  const [row] = await eventQuery(userId(req), sql`
    e.id = ${req.params.id} AND (
      e.starts_at IS NOT NULL
      OR (e.starts_at IS NULL AND e.ends_at IS NULL AND e.kind IN ('city', 'org') AND e.signup_url IS NOT NULL)
    )
  `)
  if (!row) return void res.status(404).json({ error: 'event not found' })
  res.json(toEvent(row))
})

app.post('/events', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const text = (key: string, max: number, optional = false) => {
    const value = body[key]
    if (optional && (value === undefined || value === null || value === '')) return null
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : undefined
  }
  const title = text('title', 200)
  const location = text('location', 300)
  const localArea = text('localArea', 100)
  const category = text('category', 100)
  const whatToBring = text('whatToBring', 500, true) ?? null
  const startsAt = typeof body.startsAt === 'string' ? new Date(body.startsAt) : null
  const endsAt = typeof body.endsAt === 'string' ? new Date(body.endsAt) : null
  const spotsTotal = Number(body.spotsTotal)
  const lat = body.lat === undefined ? null : Number(body.lat)
  const lng = body.lng === undefined ? null : Number(body.lng)
  const hotspotId = text('hotspotId', 300, true) ?? null
  if (!title || !location || !localArea || !category || !startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return void res.status(400).json({ error: 'title, location, localArea, category, startsAt and endsAt are required' })
  }
  if (endsAt <= startsAt || !Number.isInteger(spotsTotal) || spotsTotal < 1 || spotsTotal > 10000) {
    return void res.status(400).json({ error: 'endsAt must follow startsAt and spotsTotal must be 1-10000' })
  }
  if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
    return void res.status(400).json({ error: 'invalid coordinates' })
  }
  const user = userId(req)
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO events (
      kind, title, organiser, category, starts_at, ends_at, location, local_area,
      latitude, longitude, spots_total, what_to_bring, hotspot_id, created_by, is_sample
    ) VALUES (
      'hotspot', ${title}, ${user}, ${category}, ${startsAt}, ${endsAt}, ${location}, ${localArea},
      ${lat}, ${lng}, ${spotsTotal}, ${whatToBring}, ${hotspotId}, ${user}, false
    ) RETURNING id`
  await sql`INSERT INTO rsvps (event_id, user_id) VALUES (${created!.id}, ${user}) ON CONFLICT DO NOTHING`
  const [row] = await eventQuery(user, sql`e.id = ${created!.id}`)
  res.status(201).json(toEvent(row!))
})

type HotspotRow = {
  h3_r9: string; request_type: string; category: string | null; local_area: string | null
  times_reported: number; months_seen: number; last_reported: Date
}

app.get('/hotspots', async (_req, res) => {
  const rows = await sql<HotspotRow[]>`
    SELECT h3_r9, request_type, category, local_area, times_reported::int, months_seen::int,
           last_reported
    FROM gold_help_hotspots
    ORDER BY times_reported DESC, last_reported DESC
    LIMIT 500`
  res.json(rows.map((row) => ({
    id: `${row.h3_r9}|${row.request_type}`,
    h3_r9: row.h3_r9,
    request_type: row.request_type,
    category: row.category ?? 'Other',
    local_area: row.local_area ?? 'Vancouver',
    times_reported: row.times_reported,
    months_seen: row.months_seen,
    last_reported: row.last_reported.toISOString(),
    ...centre(row.h3_r9),
  })))
})

app.get('/me/history', async (req, res) => {
  const rows = await sql<{
    id: string; title: string | null; organiser: string | null; starts_at: Date | null
    ends_at: Date | null; done_at: Date | null; people_count: number | null; is_sample: boolean
  }[]>`
    SELECT e.id, e.title, e.organiser, e.starts_at, e.ends_at, e.done_at, e.people_count, e.is_sample
    FROM rsvps r JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ${userId(req)} AND e.done_at IS NOT NULL
    ORDER BY e.done_at DESC`
  res.json(rows.map((row) => {
    const duration = row.starts_at && row.ends_at ? Math.max((row.ends_at.getTime() - row.starts_at.getTime()) / 3_600_000, 0) : 0
    return {
      id: row.id,
      title: row.title ?? 'Volunteer activity',
      organiser: row.organiser ?? 'Unknown organiser',
      date: (row.done_at ?? row.starts_at ?? new Date(0)).toISOString(),
      hours: duration,
      sample: row.is_sample,
    }
  }))
})

// ?area=<local area> narrows the list; ?limit= caps it (default and max 5000).
app.get('/issues', async (req, res) => {
  const area = typeof req.query.area === 'string' ? req.query.area : null
  const limit = Math.min(Math.max(Number(req.query.limit) || 5000, 1), 5000)
  const rows = await issueQuery(userId(req), area ? sql`i.local_area = ${area}` : sql`true`, limit)
  res.json(rows.map(toIssue))
})

app.get('/issues/:id', async (req, res) => {
  const [row] = await issueQuery(userId(req), sql`i.issue_id = ${req.params.id}`, 1)
  if (!row) return void res.status(404).json({ error: 'issue not found' })
  res.json(toIssue(row))
})

// RSVP to an in-app event (one with spots). External events link out instead.
app.post('/events/:id/rsvp', async (req, res) => {
  const user = userId(req)
  const [e] = await sql<{ spots_total: number | null; taken: number; mine: boolean }[]>`
    SELECT e.spots_total,
           count(r.user_id)::int AS taken,
           coalesce(bool_or(r.user_id = ${user}), false) AS mine
    FROM events e LEFT JOIN rsvps r ON r.event_id = e.id
    WHERE e.id = ${req.params.id}
    GROUP BY e.id`
  if (!e) return void res.status(404).json({ error: 'event not found' })
  if (e.spots_total === null) return void res.status(409).json({ error: 'this event takes sign-ups on its own site' })
  if (!e.mine && e.taken >= e.spots_total) return void res.status(409).json({ error: 'event is full' })
  await sql`INSERT INTO rsvps (event_id, user_id) VALUES (${req.params.id}, ${user}) ON CONFLICT DO NOTHING`
  res.status(204).end()
})

app.delete('/events/:id/rsvp', async (req, res) => {
  await sql`DELETE FROM rsvps WHERE event_id = ${req.params.id} AND user_id = ${userId(req)}`
  res.status(204).end()
})

// Body {"value": 1} or {"value": -1}. One vote per user per issue.
app.put('/issues/:id/vote', async (req, res) => {
  const value = req.body?.value
  if (value !== 1 && value !== -1) return void res.status(400).json({ error: 'value must be 1 or -1' })
  const found = await sql`SELECT 1 FROM gold_track2_issues WHERE issue_id = ${req.params.id}`
  if (found.length === 0) return void res.status(404).json({ error: 'issue not found' })
  await sql`
    INSERT INTO votes (issue_id, user_id, value) VALUES (${req.params.id}, ${userId(req)}, ${value})
    ON CONFLICT (issue_id, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()`
  res.status(204).end()
})

app.delete('/issues/:id/vote', async (req, res) => {
  await sql`DELETE FROM votes WHERE issue_id = ${req.params.id} AND user_id = ${userId(req)}`
  res.status(204).end()
})

// Comments, oldest first. Issue comments need migration 004_issue_comments.sql.
for (const target of ['events', 'issues'] as const) {
  const col = sql(target === 'events' ? 'event_id' : 'issue_id')

  app.get(`/${target}/:id/comments`, async (req, res) => {
    const rows = await sql<CommentRow[]>`
      SELECT id, event_id, issue_id, user_id, body, created_at FROM comments
      WHERE ${col} = ${req.params.id} AND NOT hidden
      ORDER BY created_at, id`
    res.json(rows.map(toComment))
  })

  app.post(`/${target}/:id/comments`, async (req, res) => {
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (body.length < 1 || body.length > 2000) return void res.status(400).json({ error: 'body must be 1-2000 characters' })
    const found = target === 'events'
      ? await sql`SELECT 1 FROM events WHERE id = ${req.params.id}`
      : await sql`SELECT 1 FROM gold_track2_issues WHERE issue_id = ${req.params.id}`
    if (found.length === 0) return void res.status(404).json({ error: `${target.slice(0, -1)} not found` })
    const [row] = await sql<CommentRow[]>`
      INSERT INTO comments (${col}, user_id, body) VALUES (${req.params.id}, ${userId(req)}, ${body})
      RETURNING id, event_id, issue_id, user_id, body, created_at`
    res.status(201).json(toComment(row!))
  })
}

// Errors come back as JSON, never as an HTML stack trace.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'internal error' })
})

const port = Number(process.env.PORT ?? 8000)
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
