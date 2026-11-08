export class ApiError extends Error {
  constructor(public status: number, message: string, public details: Record<string, unknown> = {}) { super(message) }
}

export function pageLimit(value: unknown, fallback = 5000) {
  if (value === undefined) return fallback
  const n = typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(n) || n < 1 || n > 5000) throw new ApiError(400, 'limit must be an integer from 1 to 5000')
  return n
}

function text(value: unknown, field: string, max: number, optional = false): string | undefined {
  if (value === undefined && optional) return undefined
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ApiError(400, `${field} must contain 1–${max} characters`)
  return value.trim()
}

function instant(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new ApiError(400, `${field} must be an ISO timestamp with a timezone`)
  const date = new Date(value)
  const day = value.slice(0, 10)
  const calendar = new Date(`${day}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day
      || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59)
    throw new ApiError(400, `${field} is not a valid timestamp`)
  return date
}

export function parseNewEvent(input: unknown, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'JSON object required')
  const b = input as Record<string, unknown>
  const startsAt = instant(b.startsAt, 'startsAt'), endsAt = instant(b.endsAt, 'endsAt')
  if (startsAt <= now) throw new ApiError(400, 'startsAt must be in the future')
  if (endsAt <= startsAt) throw new ApiError(400, 'endsAt must be after startsAt')
  if (typeof b.spotsTotal !== 'number' || !Number.isInteger(b.spotsTotal) || b.spotsTotal < 1 || b.spotsTotal > 100)
    throw new ApiError(400, 'spotsTotal must be an integer from 1 to 100')
  const hotspotId = text(b.hotspotId, 'hotspotId', 500, true)
  if (!hotspotId && (typeof b.lat !== 'number' || typeof b.lng !== 'number'
      || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)
      || b.lat < 49.19 || b.lat > 49.32 || b.lng < -123.27 || b.lng > -123.02))
    throw new ApiError(400, 'Manual events require lat/lng within Vancouver')
  return {
    title: text(b.title, 'title', 120)!, location: text(b.location, 'location', 120)!,
    startsAt, endsAt, spotsTotal: b.spotsTotal,
    hotspotId, suggestionId: text(b.suggestionId, 'suggestionId', 30, true), whatToBring: b.whatToBring === '' ? undefined : text(b.whatToBring, 'whatToBring', 1000, true),
    category: hotspotId ? undefined : text(b.category, 'category', 100),
    localArea: hotspotId ? undefined : text(b.localArea, 'localArea', 100),
    lat: b.lat as number | undefined, lng: b.lng as number | undefined,
  }
}

/** A public display name: 1–60 characters, no control characters or angle brackets. */
export function parseDisplayName(value: unknown): string {
  const name = typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : ''
  // eslint-disable-next-line no-control-regex
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f<>]/.test(name))
    throw new ApiError(400, 'displayName must contain 1–60 characters, without < or >')
  return name
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, `${field} must be a JSON object`)
  return value as Record<string, unknown>
}

function dedupeKey(value: unknown, prefix: string): string {
  const key = text(value, 'dedupe_key', 300)!
  if (!key.startsWith(prefix)) throw new ApiError(400, `dedupe_key must start with ${prefix}`)
  return key
}

/** POST /agent/suggestions body (agent/README.md "Payload contract"). */
export function parseSuggestion(input: unknown) {
  const b = object(input, 'body')
  if (b.kind !== 'suggestion') throw new ApiError(400, 'kind must be "suggestion"')
  const orgIds = b.org_ids
  if (!Array.isArray(orgIds) || orgIds.length > 50 || !orgIds.every(id => typeof id === 'string' && id.length >= 1 && id.length <= 100))
    throw new ApiError(400, 'org_ids must be an array of up to 50 org ids')
  const draft = object(b.event_draft, 'event_draft')
  const hotspot = object(b.hotspot, 'hotspot')
  if (b.city_program !== null) object(b.city_program, 'city_program')
  return {
    localArea: text(b.local_area, 'local_area', 100)!,
    title: text(b.title, 'title', 200)!,
    body: text(b.body, 'body', 5000)!,
    orgIds: [...new Set(orgIds as string[])],
    hotspotId: text(draft.hotspot_id, 'event_draft.hotspot_id', 500)!,
    dedupeKey: dedupeKey(b.dedupe_key, 'suggestion:'),
    payload: { event_draft: draft, hotspot, city_program: b.city_program, org_ids: orgIds },
  }
}

/** POST /agent/briefings body (agent/README.md "Payload contract"). */
export function parseBriefing(input: unknown) {
  const b = object(input, 'body')
  if (b.kind !== 'briefing') throw new ApiError(400, 'kind must be "briefing"')
  if (typeof b.week_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.week_of) || !Number.isFinite(Date.parse(b.week_of)))
    throw new ApiError(400, 'week_of must be a YYYY-MM-DD date')
  return {
    localArea: text(b.local_area, 'local_area', 100)!,
    title: text(b.title, 'title', 200)!,
    body: text(b.body, 'body', 5000)!,
    dedupeKey: dedupeKey(b.dedupe_key, 'briefing:'),
    payload: { week_of: b.week_of, model: text(b.model, 'model', 100)! },
  }
}
