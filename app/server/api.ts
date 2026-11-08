// Block by Block API: what the React frontend calls (frontend/src/api/client.ts).
// Response shapes match frontend/src/types.ts: VolunteerEvent, Track2Issue, Comment.
// Run: npm --prefix app run api   (http://localhost:8000; Vite forwards /api/* here)
import express, { type NextFunction, type Request, type Response, type RequestHandler } from 'express'
import { cellToLatLng, isValidCell, latLngToCell, getResolution } from 'h3-js'
import type { Sql, TransactionSql } from 'postgres'
import { parseNewEvent, ApiError, pageLimit, parseDisplayName, parseSuggestion, parseBriefing } from './validation.js'
import { requireScope, userId, viewerId } from './auth.js'

function centre(h3: string | null): { lat?: number; lng?: number } {
  if (!h3 || !isValidCell(h3)) return {}
  const [lat, lng] = cellToLatLng(h3)
  return { lat, lng }
}

const iso = (d: Date | null) => (d ? d.toISOString() : undefined)

export function createApp(sql: Sql, authentication: RequestHandler) {

  // ---------- Track 1: volunteer events ----------

  type EventRow = {
    id: string; kind: string; title: string | null; organiser: string | null; category: string | null
    starts_at: Date | null; ends_at: Date | null; location: string | null; local_area: string | null
    spots_total: number | null; what_to_bring: string | null; signup_url: string | null
    is_sample: boolean; latitude: number | null; longitude: number | null; h3_r9: string | null
    created_at: Date; created_by: string | null; done_at: Date | null; hotspot_id: string | null
    source_withdrawn_at: Date | null; spots_taken: number; going: boolean; comment_count: number
    hosted_by_me: boolean
    has_image: boolean
    hs_request_type: string | null; hs_times_reported: number | null; hs_months_seen: number | null
  }

  // Residents host 'hotspot' events; show their display name, never their Auth0 id (needs `profiles p`).
  const organiserName = sql`CASE WHEN e.kind = 'hotspot' THEN coalesce(p.display_name, 'A neighbour') ELSE e.organiser END`

  // spots_taken leaves out the caller's own RSVP; that is `going` (see types.ts).
  function eventQuery(user: string | null, where: ReturnType<typeof sql>) {
    return sql<EventRow[]>`
      SELECT e.id, e.kind, e.title, ${organiserName} AS organiser, e.category, e.starts_at, e.ends_at, e.location,
             e.local_area, e.spots_total, e.what_to_bring, e.signup_url, e.is_sample,
             e.latitude, e.longitude, e.h3_r9, e.created_at, e.created_by, e.done_at, e.hotspot_id, e.source_withdrawn_at,
             coalesce(e.created_by = ${user}, false) AS hosted_by_me,
             (SELECT count(*)::int FROM comments c WHERE c.event_id = e.id AND NOT c.hidden) AS comment_count,
             EXISTS (SELECT 1 FROM event_images i WHERE i.event_id = e.id) AS has_image,
             count(r.user_id) FILTER (WHERE ${user}::text IS NULL OR r.user_id <> ${user})::int AS spots_taken,
             coalesce(bool_or(r.user_id = ${user}), false) AS going,
             h.request_type AS hs_request_type, h.times_reported::int AS hs_times_reported,
             h.months_seen::int AS hs_months_seen
      FROM events e
      LEFT JOIN rsvps r ON r.event_id = e.id
      LEFT JOIN profiles p ON p.user_id = e.created_by
      -- hotspot_id is "<h3_r9>|<request_type>" for events started from a help hotspot
      LEFT JOIN gold_help_hotspots h ON e.hotspot_id IN (h.h3_r9 || '|' || h.request_type, h.h3_r9 || ':' || h.request_type)
      WHERE ${where}
      GROUP BY e.id, h.h3_r9, h.request_type, p.user_id
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
      hotspotId: r.hotspot_id ?? undefined,
      hostedByMe: r.hosted_by_me,
      doneAt: iso(r.done_at),
      withdrawn: r.source_withdrawn_at !== null,
    }
  }

  // ---------- Track 2: City-only issues ----------

  type IssueRow = {
    issue_id: string; h3_r9: string; request_type: string; category: string | null; local_area: string | null
    address: string | null; open_cases: number; days_open: number; times_reported_12m: number; base_score: number
    up_votes: number; down_votes: number; my_vote: number; score: number; comment_count: number
  }

  // up_votes / down_votes leave out the caller's own vote; that is my_vote (see types.ts).
  function issueQuery(user: string | null, where: ReturnType<typeof sql>, limit: number) {
    return sql<IssueRow[]>`
      SELECT i.issue_id, i.h3_r9, i.request_type, i.category, i.local_area, i.address,
             i.open_cases::int, i.days_open::int, i.times_reported_12m::int, i.base_score::float8 AS base_score,
             count(*) FILTER (WHERE v.value = 1 AND (${user}::text IS NULL OR v.user_id IS DISTINCT FROM ${user}))::int AS up_votes,
             0::int AS down_votes,
             coalesce(max(v.value) FILTER (WHERE v.user_id = ${user} AND v.value = 1), 0)::int AS my_vote,
             coalesce(i.base_score, 0)::float8 + 3 * count(*) FILTER (WHERE v.value = 1) AS score,
             (SELECT count(*)::int FROM comments c WHERE c.issue_id = i.issue_id AND NOT c.hidden) AS comment_count
      FROM gold_track2_issues i
      LEFT JOIN votes v ON v.issue_id = i.issue_id
      WHERE ${where}
      GROUP BY i.issue_id
      ORDER BY score DESC, i.issue_id
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
      score: r.score,
      comment_count: r.comment_count,
      ...centre(r.h3_r9),
    }
  }

  // ---------- Comments ----------

  type CommentRow = { id: string; event_id: string | null; issue_id: string | null; author: string | null; body: string; created_at: Date }

  function toComment(r: CommentRow) {
    return {
      id: String(r.id),
      targetType: r.event_id ? 'event' : 'issue',
      targetId: r.event_id ?? r.issue_id,
      body: r.body,
      author: r.author ?? 'Neighbour', // display name from profiles; the Auth0 id is never sent
      authorKind: 'resident',
      createdAt: r.created_at.toISOString(),
    }
  }

  // ---------- Routes ----------

  const app = express()
  app.use(authentication)
  app.use(express.json())

  type BudgetRow = { vote_day: string; votes_used: number; resets_at: Date }
  async function voteBudget(user: string, db: Sql | TransactionSql = sql) {
    const [row] = await db<BudgetRow[]>`
      SELECT (current_timestamp AT TIME ZONE 'America/Vancouver')::date::text AS vote_day,
             coalesce((SELECT votes_used FROM vote_daily_usage WHERE user_id = ${user}
               AND vote_day = (current_timestamp AT TIME ZONE 'America/Vancouver')::date), 0)::int AS votes_used,
             (((current_timestamp AT TIME ZONE 'America/Vancouver')::date + 1)::timestamp
               AT TIME ZONE 'America/Vancouver') AS resets_at`
    return { dailyLimit: 2, votesUsed: row!.votes_used, votesRemaining: Math.max(0, 2 - row!.votes_used),
             voteDate: row!.vote_day, resetsAt: row!.resets_at.toISOString() }
  }

  async function lockVoteDay(user: string, tx: TransactionSql) {
    await tx`INSERT INTO vote_daily_usage (user_id, vote_day, votes_used)
             VALUES (${user}, (current_timestamp AT TIME ZONE 'America/Vancouver')::date, 0)
             ON CONFLICT (user_id, vote_day) DO NOTHING`
    await tx`SELECT votes_used FROM vote_daily_usage WHERE user_id = ${user}
             AND vote_day = (current_timestamp AT TIME ZONE 'America/Vancouver')::date FOR UPDATE`
  }

  // The name shown on your comments and the events you host. The frontend sets it from your Auth0
  // profile after sign-in; anyone can see it, so it's a display name, not an identifier.
  app.get('/me/profile', async (req, res) => {
    const [row] = await sql<{ display_name: string }[]>`SELECT display_name FROM profiles WHERE user_id = ${userId(req)}`
    res.json({ displayName: row?.display_name ?? null })
  })

  app.put('/me/profile', async (req, res) => {
    const user = userId(req)
    const name = parseDisplayName(req.body?.displayName)
    await sql`INSERT INTO profiles (user_id, display_name) VALUES (${user}, ${name})
      ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`
    res.json({ displayName: name })
  })

  app.get('/me/votes', async (req, res) => { res.json(await voteBudget(userId(req))) })

  app.get('/hotspots', async (req, res) => {
    const limit = pageLimit(req.query.limit)
    const area = typeof req.query.area === 'string' ? req.query.area : null
    const rows = await sql<{
      h3_r9: string; request_type: string; category: string | null; local_area: string | null
      times_reported: number; months_seen: number; last_reported: Date
    }[]>`SELECT h3_r9, request_type, category, local_area, times_reported::int, months_seen::int,
               last_reported AT TIME ZONE 'America/Vancouver' AS last_reported
        FROM gold_help_hotspots WHERE ${area ? sql`local_area = ${area}` : sql`true`}
        ORDER BY times_reported DESC, h3_r9, request_type LIMIT ${limit}`
    res.json(rows.map(r => ({ ...r, id: `${r.h3_r9}|${r.request_type}`,
      category: r.category ?? 'Other', local_area: r.local_area ?? 'Vancouver',
      last_reported: iso(r.last_reported), ...centre(r.h3_r9) })))
  })

  app.post('/events', async (req, res) => {
    const input = parseNewEvent(req.body), user = userId(req)
    let category = input.category!, localArea = input.localArea!
    let h3: string, lat: number, lng: number, hotspotId: string | null = null
    if (input.hotspotId) {
      const [hotspot] = await sql<{ h3_r9: string; request_type: string; category: string; local_area: string }[]>`
        SELECT h3_r9, request_type, category, local_area FROM gold_help_hotspots
        WHERE h3_r9 || '|' || request_type = ${input.hotspotId}
           OR h3_r9 || ':' || request_type = ${input.hotspotId}`
      if (!hotspot) throw new ApiError(404, 'hotspot not found')
      h3 = hotspot.h3_r9
      if (!isValidCell(h3) || getResolution(h3) !== 9 || !hotspot.category || !hotspot.local_area)
        throw new ApiError(409, 'hotspot is missing usable location/category data')
      ;[lat, lng] = cellToLatLng(h3)
      category = hotspot.category; localArea = hotspot.local_area
      hotspotId = `${h3}|${hotspot.request_type}`
    } else {
      const [area] = await sql`SELECT name FROM local_areas WHERE name = ${localArea}`
      if (!area) throw new ApiError(400, 'localArea must name a Vancouver local area')
      const [known] = await sql`SELECT 1 FROM gold_type_categories WHERE category = ${category} LIMIT 1`
      if (!known && !['Food and Community', 'Other'].includes(category)) throw new ApiError(400, 'unknown category')
      lat = input.lat!; lng = input.lng!; h3 = latLngToCell(lat, lng, 9)
    }
    const id = await sql.begin(async tx => {
      const [event] = await tx<{ id: string }[]>`INSERT INTO events
        (kind, title, organiser, category, starts_at, ends_at, location, local_area, spots_total,
         what_to_bring, latitude, longitude, h3_r9, hotspot_id, created_by, is_sample)
        VALUES ('hotspot', ${input.title},
                coalesce((SELECT display_name FROM profiles WHERE user_id = ${user}), 'A neighbour'), ${category}, ${input.startsAt}, ${input.endsAt},
                ${input.location}, ${localArea}, ${input.spotsTotal}, ${input.whatToBring ?? null},
                ${lat}, ${lng}, ${h3}, ${hotspotId}, ${user}, false) RETURNING id`
      await tx`INSERT INTO rsvps (event_id, user_id) VALUES (${event!.id}, ${user})`
      return event!.id
    })
    const [row] = await eventQuery(user, sql`e.id = ${id}`)
    res.status(201).location(`/events/${encodeURIComponent(id)}`).json(toEvent(row!))
  })

  app.get('/me/history', async (req, res) => {
    const rows = await sql<{ id: string; title: string | null; organiser: string | null; date: Date; hours: number; sample: boolean }[]>`
      SELECT e.id, e.title, ${organiserName} AS organiser, e.starts_at AS date, e.is_sample AS sample,
        round(greatest(0, extract(epoch FROM (least(coalesce(e.ends_at, e.done_at), e.done_at) - e.starts_at))) / 3600, 2)::float8 AS hours
      FROM events e JOIN rsvps r ON r.event_id = e.id LEFT JOIN profiles p ON p.user_id = e.created_by
      WHERE r.user_id = ${userId(req)} AND e.done_at IS NOT NULL AND e.starts_at IS NOT NULL
      ORDER BY e.starts_at DESC, e.id`
    res.json(rows.map(r => ({ ...r, title: r.title ?? 'Untitled event',
      organiser: r.organiser ?? 'Unknown organiser', date: r.date.toISOString() })))
  })

  app.post('/events/:id/done', async (req, res) => {
    const user = userId(req)
    const b = req.body ?? {}
    for (const field of ['peopleCount', 'bagsCollected']) {
      if (b[field] !== undefined && (!Number.isInteger(b[field]) || b[field] < 0 || b[field] > 10000))
        throw new ApiError(400, `${field} must be an integer from 0 to 10000`)
    }
    if (b.afterPhotoUrl !== undefined) {
      try { if (typeof b.afterPhotoUrl !== 'string' || b.afterPhotoUrl.length > 2048 || new URL(b.afterPhotoUrl).protocol !== 'https:') throw new Error() }
      catch { throw new ApiError(400, 'afterPhotoUrl must be an HTTPS URL') }
    }
    await sql.begin(async tx => {
      const [event] = await tx<{ created_by: string | null; kind: string; starts_at: Date | null; done_at: Date | null; source_withdrawn_at: Date | null }[]>`
        SELECT created_by, kind, starts_at, done_at, source_withdrawn_at FROM events WHERE id = ${req.params.id} FOR UPDATE`
      if (!event) throw new ApiError(404, 'event not found')
      if (event.created_by !== user) throw new ApiError(403, 'only the host can complete this event')
      if (event.kind !== 'hotspot' || event.source_withdrawn_at) throw new ApiError(409, 'event cannot be completed in the app')
      if (event.done_at) return
      if (!event.starts_at || event.starts_at > new Date()) throw new ApiError(409, 'event has not started')
      await tx`UPDATE events SET done_at = now(), people_count = ${b.peopleCount ?? null},
               bags_collected = ${b.bagsCollected ?? null}, after_photo_url = ${b.afterPhotoUrl ?? null}
               WHERE id = ${req.params.id}`
    })
    const [row] = await eventQuery(user, sql`e.id = ${req.params.id}`)
    res.json(toEvent(row!))
  })

  app.get('/health', async (_req, res) => {
    await sql`SELECT 1`
    res.json({ ok: true })
  })

  // Active upcoming dated events plus supported ongoing external opportunities.
  app.get('/events', async (req, res) => {
    const rows = await eventQuery(viewerId(req), sql`
      e.source_withdrawn_at IS NULL AND e.done_at IS NULL AND (
        e.starts_at >= now() - interval '1 day'
        OR (e.starts_at IS NULL AND e.ends_at IS NULL AND e.kind IN ('city', 'org') AND e.signup_url IS NOT NULL)
      ) AND (
        -- sample events only fill the feed while there are no real ones
        NOT e.is_sample
        OR NOT EXISTS (
          SELECT 1 FROM events real
          WHERE NOT real.is_sample AND real.source_withdrawn_at IS NULL AND real.done_at IS NULL
            AND (real.starts_at >= now() - interval '1 day'
              OR (real.starts_at IS NULL AND real.ends_at IS NULL AND real.kind IN ('city', 'org') AND real.signup_url IS NOT NULL))
        )
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
    const [row] = await eventQuery(viewerId(req), sql`
      e.id = ${req.params.id} AND (
        e.starts_at IS NOT NULL
        OR (e.starts_at IS NULL AND e.ends_at IS NULL AND e.kind IN ('city', 'org') AND e.signup_url IS NOT NULL)
      )
    `)
    if (!row) return void res.status(404).json({ error: 'event not found' })
    res.json(toEvent(row))
  })

  // ?area=<local area> narrows the list; ?limit= caps it (default and max 5000).
  app.get('/issues', async (req, res) => {
    const area = typeof req.query.area === 'string' ? req.query.area : null
    const limit = pageLimit(req.query.limit)
    const rows = await issueQuery(viewerId(req), area ? sql`i.local_area = ${area}` : sql`true`, limit)
    res.json(rows.map(toIssue))
  })

  app.get('/issues/:id', async (req, res) => {
    const [row] = await issueQuery(viewerId(req), sql`i.issue_id = ${req.params.id}`, 1)
    if (!row) return void res.status(404).json({ error: 'issue not found' })
    res.json(toIssue(row))
  })

  // RSVP to an in-app event (one with spots). External events link out instead.
  app.post('/events/:id/rsvp', async (req, res) => {
    const user = userId(req)
    await sql.begin(async tx => {
      const [event] = await tx<{ spots_total: number | null; done_at: Date | null; source_withdrawn_at: Date | null }[]>`
        SELECT spots_total, done_at, source_withdrawn_at FROM events WHERE id = ${req.params.id} FOR UPDATE`
      if (!event) throw new ApiError(404, 'event not found')
      if (event.done_at || event.source_withdrawn_at) throw new ApiError(409, 'event is completed or withdrawn')
      if (event.spots_total === null) throw new ApiError(409, 'this event takes sign-ups on its own site')
      const [count] = await tx<{ taken: number; mine: boolean }[]>`
        SELECT count(*)::int AS taken, coalesce(bool_or(user_id = ${user}), false) AS mine
        FROM rsvps WHERE event_id = ${req.params.id}`
      if (!count!.mine && count!.taken >= event.spots_total) throw new ApiError(409, 'event is full')
      await tx`INSERT INTO rsvps (event_id, user_id) VALUES (${req.params.id}, ${user}) ON CONFLICT DO NOTHING`
    })
    res.status(204).end()
  })

  app.delete('/events/:id/rsvp', async (req, res) => {
    await sql.begin(async tx => {
      const [event] = await tx`SELECT done_at FROM events WHERE id = ${req.params.id} FOR UPDATE`
      if (event?.done_at) throw new ApiError(409, 'completed event attendance is retained in history')
      await tx`DELETE FROM rsvps WHERE event_id = ${req.params.id} AND user_id = ${userId(req)}`
    })
    res.status(204).end()
  })

  // Upvotes only. The per-user/day row lock serializes quota checks across API workers.
  app.put('/issues/:id/vote', async (req, res) => {
    if (req.body?.value !== 1) throw new ApiError(400, 'value must be 1; downvotes are not supported')
    const user = userId(req)
    const budget = await sql.begin(async tx => {
      const found = await tx`SELECT 1 FROM gold_track2_issues WHERE issue_id = ${req.params.id}`
      if (!found.length) throw new ApiError(404, 'issue not found')
      await lockVoteDay(user, tx)
      const [existing] = await tx`SELECT value FROM votes WHERE issue_id = ${req.params.id} AND user_id = ${user}`
      if (existing?.value === 1) return voteBudget(user, tx)
      const updated = await tx`UPDATE vote_daily_usage SET votes_used = votes_used + 1
        WHERE user_id = ${user} AND vote_day = (current_timestamp AT TIME ZONE 'America/Vancouver')::date
          AND votes_used < 2 RETURNING votes_used`
      if (!updated.length) throw new ApiError(429, 'Daily vote limit reached',
        { code: 'DAILY_VOTE_LIMIT', ...await voteBudget(user, tx) })
      await tx`INSERT INTO votes (issue_id, user_id, value, created_at) VALUES (${req.params.id}, ${user}, 1, now())
        ON CONFLICT (issue_id, user_id) DO UPDATE SET value = 1, created_at = EXCLUDED.created_at`
      await tx`INSERT INTO vote_casts (user_id, issue_id) VALUES (${user}, ${req.params.id})`
      return voteBudget(user, tx)
    })
    res.json({ ...budget, myVote: 1 })
  })

  app.delete('/issues/:id/vote', async (req, res) => {
    const user = userId(req)
    const budget = await sql.begin(async tx => {
      await lockVoteDay(user, tx)
      await tx`DELETE FROM votes WHERE issue_id = ${req.params.id} AND user_id = ${user}`
      return voteBudget(user, tx)
    })
    res.json({ ...budget, myVote: 0 })
  })

  // Comments, oldest first. Issue comments need migration 004_issue_comments.sql.
  for (const target of ['events', 'issues'] as const) {
    const col = sql(target === 'events' ? 'event_id' : 'issue_id')

    app.get(`/${target}/:id/comments`, async (req, res) => {
      const rows = await sql<CommentRow[]>`
        SELECT c.id, c.event_id, c.issue_id, p.display_name AS author, c.body, c.created_at
        FROM comments c LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.${col} = ${req.params.id} AND NOT c.hidden
        ORDER BY c.created_at, c.id`
      res.json(rows.map(toComment))
    })

    app.post(`/${target}/:id/comments`, async (req, res) => {
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
      if (body.length < 1 || body.length > 2000) return void res.status(400).json({ error: 'body must be 1-2000 characters' })
      const found = target === 'events'
        ? await sql`SELECT 1 FROM events WHERE id = ${req.params.id}`
        : await sql`SELECT 1 FROM gold_track2_issues WHERE issue_id = ${req.params.id}`
      if (found.length === 0) return void res.status(404).json({ error: `${target.slice(0, -1)} not found` })
      const user = userId(req)
      const [row] = await sql<CommentRow[]>`
        INSERT INTO comments (${col}, user_id, body) VALUES (${req.params.id}, ${user}, ${body})
        RETURNING id, event_id, issue_id, (SELECT display_name FROM profiles WHERE user_id = ${user}) AS author, body, created_at`
      res.status(201).json(toComment(row!))
    })
  }

  // ---------- Block Steward agent (Auth0 machine tokens, agent/README.md) ----------
  // Suggestions are stored 'pending' for org admins to accept or dismiss; briefings are published.
  // A repeat is answered 200 with stored: 0, so the agent doesn't count it as a failed send.

  app.post('/agent/suggestions', async (req, res) => {
    requireScope(req, 'suggestions:post')
    const s = parseSuggestion(req.body)
    // The agent writes "<h3>:<type>", the app "<h3>|<type>"; H3 ids have no ':' so the first one is the separator.
    const hotspotId = s.hotspotId.replace(':', '|')
    const result = await sql.begin(async tx => {
      if (s.orgIds.length) {
        const known = await tx<{ id: string }[]>`SELECT id FROM orgs WHERE id IN ${tx(s.orgIds)}`
        const missing = s.orgIds.filter(id => !known.some(k => k.id === id))
        if (missing.length) throw new ApiError(400, 'unknown org_ids', { missing })
      }
      let stored = 0, skipped = 0
      for (const orgId of s.orgIds.length ? s.orgIds : [null]) {
        // A pending or dismissed suggestion for this hotspot and org in the last 14 days wins.
        const recent = await tx`SELECT 1 FROM posts WHERE kind = 'suggestion' AND hotspot_id = ${hotspotId}
          AND org_id IS NOT DISTINCT FROM ${orgId} AND status IN ('pending', 'dismissed')
          AND created_at > now() - interval '14 days' LIMIT 1`
        if (recent.length) { skipped++; continue }
        const inserted = await tx`INSERT INTO posts (local_area, kind, author, org_id, title, body, status, payload, dedupe_key, hotspot_id)
          VALUES (${s.localArea}, 'suggestion', 'block-steward-agent', ${orgId}, ${s.title}, ${s.body}, 'pending',
                  ${tx.json(s.payload as never)}, ${s.dedupeKey}, ${hotspotId})
          ON CONFLICT DO NOTHING RETURNING id`
        if (inserted.length) stored++; else skipped++
      }
      return { stored, skipped }
    })
    res.status(result.stored ? 201 : 200).json(result)
  })

  app.post('/agent/briefings', async (req, res) => {
    requireScope(req, 'briefings:post')
    const b = parseBriefing(req.body)
    const inserted = await sql`INSERT INTO posts (local_area, kind, author, title, body, status, payload, dedupe_key)
      VALUES (${b.localArea}, 'briefing', 'block-steward-agent', ${b.title}, ${b.body}, 'published',
              ${sql.json(b.payload)}, ${b.dedupeKey})
      ON CONFLICT DO NOTHING RETURNING id`
    res.status(inserted.length ? 201 : 200).json({ stored: inserted.length, skipped: 1 - inserted.length })
  })

  // Published briefings, newest first. Body is plain text: render with white-space: pre-wrap, never as HTML.
  app.get('/briefings', async (req, res) => {
    const area = typeof req.query.area === 'string' ? req.query.area : null
    const rows = await sql<{ id: string; local_area: string; title: string | null; body: string; payload: { week_of?: string } | null; created_at: Date }[]>`
      SELECT id, local_area, title, body, payload, created_at FROM posts
      WHERE kind = 'briefing' AND status = 'published' AND ${area ? sql`local_area = ${area}` : sql`true`}
      ORDER BY created_at DESC, id DESC LIMIT 50`
    res.json(rows.map(r => ({ id: String(r.id), localArea: r.local_area, title: r.title ?? `This week in ${r.local_area}`,
      body: r.body, weekOf: r.payload?.week_of ?? null, createdAt: r.created_at.toISOString() })))
  })

  // Errors come back as JSON, never as an HTML stack trace.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) return void res.status(err.status).json({ error: err.message, ...err.details })
    if (err instanceof SyntaxError && 'status' in err && err.status === 400)
      return void res.status(400).json({ error: 'Invalid JSON' })
    console.error(err)
    res.status(500).json({ error: 'internal error' })
  })

  return app
}
