import { load } from 'cheerio'
import type { VolunteerListing, VolunteerSnapshot, VolunteerSourceAdapter } from './types.js'

const PAGE_URL = 'https://greenteamscanada.ca/locations/lower-mainland-green-team/'
const OFFICIAL_IMAGE = 'https://greenteamscanada.ca/wp-content/uploads/2023/11/GT-get-involved-1024x271.jpg'
const USER_AGENT = 'GreenHandsBC-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)'

export function parseLowerMainlandOpportunity(html: string, source: string): VolunteerSnapshot {
  const $ = load(html)
  const heading = $('h1').first().text().replace(/\s+/g, ' ').trim()
  const join = $('a[href*="meetup.com/The-Lower-Mainland-Green-Team"], a[href*="meetup.com/the-lower-mainland-green-team"]')
    .first()
    .attr('href')
  const description = $('p').toArray().map((node) => $(node).text().replace(/\s+/g, ' ').trim())
    .find((text) => /Lower Mainland Green Team is a program of Green Teams of Canada/i.test(text))

  if (heading !== 'Lower Mainland Green Team' || !join || !description) {
    throw new Error(`${source}: official page did not contain the expected Lower Mainland signup opportunity`)
  }

  const listing: VolunteerListing = {
    source,
    sourceKey: 'lower-mainland-green-team',
    kind: 'org',
    title: 'Join the Lower Mainland Green Team',
    organiser: 'Lower Mainland Green Team',
    category: 'Parks and Trees',
    startsAt: null,
    endsAt: null,
    location: 'Lower Mainland, BC',
    localArea: null,
    latitude: null,
    longitude: null,
    spotsTotal: null,
    whatToBring: 'Join hands-on environmental activities including habitat restoration, planting and litter cleanups.',
    signupUrl: join,
    imageSourceUrl: OFFICIAL_IMAGE,
    imageAttribution: 'Green Teams of Canada',
    imageLicense: null,
  }
  return { listings: [listing], validated: true }
}

export class GreenTeamsOpportunitiesAdapter implements VolunteerSourceAdapter {
  readonly id = 'green-teams-canada-opportunities'

  async fetchListings(): Promise<VolunteerSnapshot> {
    const response = await fetch(PAGE_URL, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`${this.id}: ${response.status} ${response.statusText}`)
    return parseLowerMainlandOpportunity(await response.text(), this.id)
  }
}
