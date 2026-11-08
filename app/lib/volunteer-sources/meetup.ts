import { load } from 'cheerio'
import type { VolunteerListing, VolunteerSnapshot, VolunteerSourceAdapter } from './types.js'

type JsonLdEvent = {
  '@type'?: string
  name?: string
  startDate?: string
  endDate?: string
  url?: string
  location?: string | { name?: string; address?: string | { streetAddress?: string; addressLocality?: string } }
  organizer?: { name?: string }
  maximumAttendeeCapacity?: number
}

function flattenJsonLd(value: unknown): JsonLdEvent[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd)
  if (!value || typeof value !== 'object') return []
  const object = value as Record<string, unknown>
  const own = object['@type'] === 'Event' ? [object as JsonLdEvent] : []
  return [...own, ...flattenJsonLd(object['@graph'])]
}

function locationText(location: JsonLdEvent['location']): string | null {
  if (!location) return null
  if (typeof location === 'string') return location
  const address = typeof location.address === 'string'
    ? location.address
    : [location.address?.streetAddress, location.address?.addressLocality].filter(Boolean).join(', ')
  return [location.name, address].filter(Boolean).join(' · ') || null
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
  const confirmedEmpty = hasEventsHeading && (/\b0\s*List\b/i.test(pageText) || !hasEventLinks)
  if (!events.length && !confirmedEmpty) {
    throw new Error(`${sourceId}: page did not contain event metadata or a confirmed empty event count`)
  }

  const seen = new Set<string>()
  const listings = events.flatMap((event): VolunteerListing[] => {
    if (!event.name || !event.startDate || !event.url) return []
    if (new Date(event.endDate ?? event.startDate).getTime() < now) return []
    const sourceKey = eventKey(event.url)
    if (seen.has(sourceKey)) return []
    seen.add(sourceKey)
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
      latitude: null,
      longitude: null,
      spotsTotal: event.maximumAttendeeCapacity ?? null,
      whatToBring: null,
      signupUrl: event.url,
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
        'user-agent': 'BlockByBlock-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`${this.id}: ${response.status} ${response.statusText}`)

    return parseMeetupListings(await response.text(), this.id, this.organiser)
  }
}
