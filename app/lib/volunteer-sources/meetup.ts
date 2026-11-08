import { load } from 'cheerio'
import type { VolunteerListing, VolunteerSnapshot, VolunteerSourceAdapter } from './types.js'

type JsonLdEvent = {
  '@type'?: string | string[]
  name?: string
  startDate?: string
  endDate?: string
  eventStatus?: string
  url?: string
  location?: string | { name?: string; address?: string | { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string }; geo?: { latitude?: number | string; longitude?: number | string } }
  organizer?: { name?: string }
  maximumAttendeeCapacity?: number
  image?: string | string[] | { url?: string; contentUrl?: string } | Array<{ url?: string; contentUrl?: string }>
}

function flattenJsonLd(value: unknown): JsonLdEvent[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd)
  if (!value || typeof value !== 'object') return []
  const object = value as Record<string, unknown>
  const type = object['@type']
  const own = (type === 'Event' || (Array.isArray(type) && type.includes('Event'))) ? [object as JsonLdEvent] : []
  return [...own, ...flattenJsonLd(object['@graph'])]
}

function locationText(location: JsonLdEvent['location']): string | null {
  if (!location) return null
  if (typeof location === 'string') return location
  const address = typeof location.address === 'string'
    ? location.address
    : [location.address?.streetAddress, location.address?.addressLocality, location.address?.addressRegion, location.address?.postalCode].filter(Boolean).join(', ')
  return [location.name, address].filter(Boolean).join(' · ') || null
}

function imageUrl(image: JsonLdEvent['image']): string | undefined {
  const candidates = Array.isArray(image) ? image : [image]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate
    if (candidate && typeof candidate === 'object') {
      if (candidate.contentUrl) return candidate.contentUrl
      if (candidate.url) return candidate.url
    }
  }
  return undefined
}

function eventKey(url: string): string {
  const match = url.match(/\/events\/(\d+)/)
  return match?.[1] ?? new URL(url).pathname.replace(/^\/|\/$/g, '').replaceAll('/', '-')
}

export function parseMeetupListings(html: string, sourceId: string, fallbackOrganiser: string, now = Date.now()): VolunteerSnapshot {
  const $ = load(html)
  const events: JsonLdEvent[] = []
  $('script[type="application/ld+json"]').each((_index, script) => {
    try {
      events.push(...flattenJsonLd(JSON.parse($(script).text())))
    } catch {
      // Ignore unrelated metadata blocks; validation below rejects an unrecognized page.
    }
  })

  const pageText = $('body').text().replace(/\s+/g, ' ')
  const hasEventsHeading = $('h1, h2, h3').toArray().some((heading) => $(heading).text().trim() === 'Events')
  const hasEventLinks = $('a[href*="/events/"]').length > 0
  const confirmedEmpty = hasEventsHeading && /0\s*List\b/i.test(pageText) && !hasEventLinks
  if (!events.length && !confirmedEmpty) {
    throw new Error(`${sourceId}: page did not contain event metadata or a confirmed empty event count`)
  }

  const seen = new Set<string>()
  const listings = events.flatMap((event): VolunteerListing[] => {
    if (!event.name || !event.startDate || !event.url || event.eventStatus?.endsWith('EventCancelled')) return []
    const start = Date.parse(event.startDate), end = Date.parse(event.endDate ?? event.startDate)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < now) return []
    let url: URL
    try { url = new URL(event.url) } catch { return [] }
    if (url.protocol !== 'https:' || !['meetup.com', 'www.meetup.com'].includes(url.hostname)) return []
    const sourceKey = eventKey(event.url)
    if (seen.has(sourceKey)) return []
    seen.add(sourceKey)
    const geo = typeof event.location === 'object' ? event.location.geo : undefined
    const lat = Number(geo?.latitude), lng = Number(geo?.longitude)
    const validGeo = geo?.latitude != null && geo?.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 48 && lat <= 50 && lng >= -124 && lng <= -121
    return [{
      source: sourceId,
      sourceKey,
      kind: 'org',
      title: event.name,
      organiser: event.organizer?.name ?? fallbackOrganiser,
      category: 'Parks and Trees',
      startsAt: event.startDate,
      endsAt: event.endDate ?? null,
      location: locationText(event.location),
      localArea: null,
      latitude: validGeo ? lat : null,
      longitude: validGeo ? lng : null,
      spotsTotal: event.maximumAttendeeCapacity ?? null,
      whatToBring: null,
      signupUrl: event.url,
      imageSourceUrl: imageUrl(event.image),
      imageAttribution: event.organizer?.name ?? fallbackOrganiser,
      imageLicense: null,
    }]
  })
  return { listings, validated: true }
}

export class MeetupPublicPageAdapter implements VolunteerSourceAdapter {
  readonly id: string

  constructor(
    private readonly groupUrl: string,
    private readonly organiser: string,
    id = 'meetup-lower-mainland-green-team',
  ) {
    this.id = id
  }

  async fetchListings(): Promise<VolunteerSnapshot> {
    const response = await fetch(this.groupUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-CA,en;q=0.9',
        'user-agent': 'GreenHandsBC-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`${this.id}: ${response.status} ${response.statusText}`)

    const html = await response.text()
    const $ = load(html)
    const groupPath = new URL(this.groupUrl).pathname.replace(/\/$/, '').toLowerCase()
    const urls = new Set<string>()
    $('a[href*="/events/"]').each((_i, a) => {
      try {
        const url = new URL($(a).attr('href') ?? '', this.groupUrl)
        if (!['www.meetup.com', 'meetup.com'].includes(url.hostname)) return
        const match = url.pathname.toLowerCase().match(/^\/([^/]+)\/events\/(\d+)\/?$/)
        if (match && `/${match[1]}` === groupPath) urls.add(`https://www.meetup.com/${match[1]}/events/${match[2]}/`)
      } catch { /* ignore invalid links */ }
    })
    let listings: VolunteerListing[] = []
    try { listings = parseMeetupListings(html, this.id, this.organiser).listings } catch { /* try event pages */ }
    listings = listings.filter((listing) => new URL(listing.signupUrl).pathname.toLowerCase().startsWith(`${groupPath}/events/`))
    if (urls.size > 50) throw new Error(`${this.id}: too many event links; refusing incomplete collection`)
    for (const url of urls) {
      const eventResponse = await fetch(url, {
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'GreenHandsBC-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!eventResponse.ok) throw new Error(`${this.id}: event page returned ${eventResponse.status}`)
      const page = parseMeetupListings(await eventResponse.text(), this.id, this.organiser)
      listings.push(...page.listings.filter((event) => event.sourceKey === eventKey(url)))
    }
    if (!urls.size && !listings.length) throw new Error(`${this.id}: no discoverable events; source may be empty or changed`)
    listings = [...new Map(listings.map((item) => [item.sourceKey, item])).values()]
    // Group pages may list only a subset of events.
    return { listings, validated: true, allowWithdrawal: false }
  }
}
