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
    hotspotId, whatToBring: b.whatToBring === '' ? undefined : text(b.whatToBring, 'whatToBring', 1000, true),
    category: hotspotId ? undefined : text(b.category, 'category', 100),
    localArea: hotspotId ? undefined : text(b.localArea, 'localArea', 100),
    lat: b.lat as number | undefined, lng: b.lng as number | undefined,
  }
}
