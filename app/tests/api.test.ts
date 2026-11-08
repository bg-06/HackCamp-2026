import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Server } from 'node:http'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { latLngToCell } from 'h3-js'
import { createApp } from '../server/api.js'

let db: PGlite, socket: PGLiteSocketServer, sql: ReturnType<typeof postgres>, http: Server, base: string
const cell = latLngToCell(49.26, -123.1, 9)
const hotspotId = `${cell}|Loose Litter Clean Up Case`
const migrations = fileURLToPath(new URL('../../db/migrations/', import.meta.url))

before(async () => {
  db = await PGlite.create()
  for (const name of (await readdir(migrations)).filter(n => n.endsWith('.sql')).sort())
    await db.exec(await readFile(`${migrations}/${name}`, 'utf8'))
  socket = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 5 })
  await socket.start()
  sql = postgres(`postgres://postgres:postgres@${socket.getServerConn()}/postgres`, {
    ssl: false, max: 4, idle_timeout: 0, onnotice: () => {},
  })
  http = createApp(sql).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => http.once('listening', resolve))
  const address = http.address()
  assert.ok(address && typeof address === 'object')
  base = `http://127.0.0.1:${address.port}`
})

after(async () => {
  if (http) await new Promise<void>(resolve => http.close(() => resolve()))
  if (sql) await sql.end({ timeout: 1 })
  if (socket) await socket.stop()
  if (db) await db.close()
})

beforeEach(async () => {
  await sql`TRUNCATE vote_casts, vote_daily_usage, votes, comments, rsvps, events,
    gold_help_hotspots, gold_track2_issues, gold_type_categories, local_areas CASCADE`
  await sql`INSERT INTO local_areas (name, geom, representative_point, source_record)
    VALUES ('Mount Pleasant', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`
  await sql`INSERT INTO gold_type_categories VALUES ('Loose Litter Clean Up Case', 'Garbage and Dumping', 'neighbours')`
  await sql`INSERT INTO gold_help_hotspots VALUES (${cell}, 'Loose Litter Clean Up Case', 'Garbage and Dumping',
    'Mount Pleasant', 12, 4, '2026-11-05 10:00:00')`
  for (const id of ['issue-1', 'issue-2', 'issue-3'])
    await sql`INSERT INTO gold_track2_issues (issue_id, h3_r9, request_type, category, local_area, base_score)
      VALUES (${id}, ${cell}, 'Pothole', 'Roads and Sidewalks', 'Mount Pleasant', 10)`
})

async function request(path: string, method = 'GET', body?: unknown, user = 'alice') {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-demo-user': user },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) })
  const text = await response.text()
  const value = text ? JSON.parse(text) : undefined
  return { status: response.status, body: value }
}

function eventInput() {
  return { hotspotId, title: 'Neighbourhood cleanup', location: 'Meeting point', spotsTotal: 10,
    startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 93600000).toISOString() }
}

test('hotspots expose stable IDs, coordinates, area filtering and timestamp instants', async () => {
  const result = await request('/hotspots?area=Mount%20Pleasant')
  assert.equal(result.status, 200)
  assert.equal(result.body[0].id, hotspotId)
  assert.equal(result.body[0].times_reported, 12)
  assert.equal(typeof result.body[0].lat, 'number')
  assert.ok(result.body[0].last_reported.endsWith('Z'))
  assert.deepEqual((await request('/hotspots?area=Elsewhere')).body, [])
  assert.equal((await request('/hotspots?limit=1.5')).status, 400)
})

test('event creation trusts hotspot data and atomically RSVPs its host', async () => {
  const result = await request('/events', 'POST', { ...eventInput(), category: 'spoofed', lat: 0, lng: 0, createdBy: 'mallory' })
  assert.equal(result.status, 201)
  assert.equal(result.body.category, 'Garbage and Dumping')
  assert.equal(result.body.hotspotId, hotspotId)
  assert.equal(result.body.createdBy, 'alice')
  assert.equal(result.body.going, true)
  assert.equal(result.body.spotsTaken, 0)
  assert.equal(result.body.sample, false)
  const [stored] = await sql`SELECT h3_r9, created_by FROM events WHERE id = ${result.body.id}`
  assert.equal(stored!.h3_r9, cell)
  assert.equal(stored!.created_by, 'alice')
})

test('manual events derive a resolution-9 cell and reject invalid input without writes', async () => {
  const input = { ...eventInput(), hotspotId: undefined, lat: 49.26, lng: -123.1,
    category: 'Garbage and Dumping', localArea: 'Mount Pleasant' }
  assert.equal((await request('/events', 'POST', { ...input, lat: 0 })).status, 400)
  assert.equal((await request('/events', 'POST', { ...input, endsAt: input.startsAt })).status, 400)
  assert.equal((await request('/events', 'POST', { ...input, startsAt: '2027-02-30T10:00:00-07:00' })).status, 400)
  assert.equal((await request('/events', 'POST', { ...eventInput(), hotspotId: 'missing' })).status, 404)
  assert.equal((await sql`SELECT count(*)::int AS n FROM events`)[0]!.n, 0)
  const created = await request('/events', 'POST', input)
  assert.equal(created.status, 201)
  assert.equal((await sql`SELECT h3_r9 FROM events WHERE id = ${created.body.id}`)[0]!.h3_r9, cell)
})

test('history requires completion; only the host can complete and completion is idempotent', async () => {
  const created = await request('/events', 'POST', eventInput())
  const id = created.body.id
  await sql`UPDATE events SET starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' WHERE id = ${id}`
  await sql`INSERT INTO rsvps VALUES (${id}, 'bob', now())`
  assert.deepEqual((await request('/me/history')).body, [])
  assert.equal((await request(`/events/${id}/done`, 'POST', {}, 'bob')).status, 403)
  const done = await request(`/events/${id}/done`, 'POST', { peopleCount: 2, bagsCollected: 3 })
  assert.equal(done.status, 200)
  assert.ok(done.body.doneAt)
  assert.equal((await request(`/events/${id}/done`, 'POST', {})).body.doneAt, done.body.doneAt)
  const history = await request('/me/history', 'GET', undefined, 'bob')
  assert.equal(history.body.length, 1)
  assert.equal(history.body[0].hours, 2)
  assert.deepEqual((await request('/me/history', 'GET', undefined, 'outsider')).body, [])
  assert.equal((await request(`/events/${id}/rsvp`, 'POST', undefined, 'outsider')).status, 409)
  assert.equal((await request(`/events/${id}/rsvp`, 'DELETE', undefined, 'bob')).status, 409)
})

test('future events cannot be completed and do not generate volunteer hours', async () => {
  const created = await request('/events', 'POST', eventInput())
  assert.equal((await request(`/events/${created.body.id}/done`, 'POST', {})).status, 409)
  assert.deepEqual((await request('/me/history')).body, [])
})

test('upvotes enforce two casts per day, retain spent allowance after removal, and make repeats idempotent', async () => {
  assert.equal((await request('/me/votes')).body.votesRemaining, 2)
  assert.equal((await request('/issues/issue-1/vote', 'PUT', { value: -1 })).status, 400)
  assert.equal((await request('/issues/issue-1/vote', 'PUT', { value: 1 })).body.votesRemaining, 1)
  assert.equal((await request('/issues/issue-1/vote', 'PUT', { value: 1 })).body.votesRemaining, 1)
  assert.equal((await request('/issues/issue-1/vote', 'DELETE')).body.votesRemaining, 1)
  assert.equal((await request('/issues/issue-1/vote', 'PUT', { value: 1 })).body.votesRemaining, 0)
  const denied = await request('/issues/issue-2/vote', 'PUT', { value: 1 })
  assert.equal(denied.status, 429)
  assert.equal(denied.body.code, 'DAILY_VOTE_LIMIT')
  assert.equal(denied.body.votesRemaining, 0)
  assert.equal((await sql`SELECT count(*)::int AS n FROM vote_casts`)[0]!.n, 2)
  assert.equal((await request('/me/votes', 'GET', undefined, 'bob')).body.votesRemaining, 2)
})

test('parallel attempts cannot exceed the daily allowance', async () => {
  const responses = await Promise.all(['issue-1', 'issue-2', 'issue-3'].map(id => request(`/issues/${id}/vote`, 'PUT', { value: 1 })))
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 200, 429])
  assert.equal((await sql`SELECT count(*)::int AS n FROM votes WHERE user_id = 'alice'`)[0]!.n, 2)
})

test('parallel repeats of the same vote spend only one allowance', async () => {
  const responses = await Promise.all([1, 2].map(() => request('/issues/issue-1/vote', 'PUT', { value: 1 })))
  assert.ok(responses.every(r => r.status === 200 && r.body.votesRemaining === 1))
  assert.equal((await sql`SELECT count(*)::int AS n FROM vote_casts`)[0]!.n, 1)
})

test('event capacity remains bounded under parallel RSVPs', async () => {
  const created = await request('/events', 'POST', { ...eventInput(), spotsTotal: 2 })
  const responses = await Promise.all(['bob', 'charlie'].map(user => request(`/events/${created.body.id}/rsvp`, 'POST', undefined, user)))
  assert.deepEqual(responses.map(r => r.status).sort(), [204, 409])
})

test('legacy downvotes do not lower scores; scores include all upvotes and comments do not multiply them', async () => {
  await sql`INSERT INTO votes (issue_id, user_id, value) VALUES ('issue-1', 'bob', -1)`
  await request('/issues/issue-2/vote', 'PUT', { value: 1 })
  await sql`INSERT INTO comments (issue_id, user_id, body) VALUES ('issue-2', 'bob', 'One'), ('issue-2', 'bob', 'Two')`
  const result = await request('/issues')
  assert.equal(result.body[0].issue_id, 'issue-2')
  assert.equal(result.body[0].score, 13)
  assert.equal(result.body[0].up_votes, 0)
  assert.equal(result.body[0].my_vote, 1)
  assert.equal(result.body[0].comment_count, 2)
  assert.equal(result.body.find((i: { issue_id: string }) => i.issue_id === 'issue-1').score, 10)
  assert.ok(result.body.every((i: { down_votes: number }) => i.down_votes === 0))
})

test('previous-day budget does not spend today and nonexistent issues consume no allowance', async () => {
  await sql`INSERT INTO vote_daily_usage VALUES ('alice', (now() AT TIME ZONE 'America/Vancouver')::date - 1, 2)`
  assert.equal((await request('/me/votes')).body.votesRemaining, 2)
  assert.equal((await request('/issues/missing/vote', 'PUT', { value: 1 })).status, 404)
  assert.equal((await request('/me/votes')).body.votesRemaining, 2)
})

test('budget migration backfills existing upvotes and remains safe to replay without refunds', async () => {
  await sql`INSERT INTO votes (issue_id, user_id, value) VALUES ('issue-1', 'alice', 1), ('issue-2', 'alice', 1), ('issue-3', 'bob', -1)`
  const migration = await readFile(`${migrations}/006_vote_budget.sql`, 'utf8')
  await sql.unsafe(migration)
  assert.equal((await request('/me/votes')).body.votesRemaining, 0)
  assert.equal((await request('/me/votes', 'GET', undefined, 'bob')).body.votesRemaining, 2)
  await request('/issues/issue-1/vote', 'DELETE')
  await sql.unsafe(migration)
  assert.equal((await request('/me/votes')).body.votesRemaining, 0)
  assert.equal((await sql`SELECT count(*)::int AS n FROM vote_casts`)[0]!.n, 2)
})
