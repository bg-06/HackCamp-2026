import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { VolunteerListing, VolunteerSourceAdapter } from './types.js'

type CuratedOpportunity = Omit<VolunteerListing, 'source' | 'kind' | 'startsAt' | 'endsAt' | 'localArea' | 'latitude' | 'longitude' | 'spotsTotal'>

export class CityCuratedAdapter implements VolunteerSourceAdapter {
  readonly id = 'vancouver-city-volunteer-programs'

  async fetchListings(): Promise<VolunteerListing[]> {
    const here = dirname(fileURLToPath(import.meta.url))
    const path = join(here, '../../../../data/seed/city_volunteer_opportunities.json')
    const entries = JSON.parse(await readFile(path, 'utf8')) as CuratedOpportunity[]
    return entries.map((entry) => ({
      ...entry,
      source: this.id,
      kind: 'city',
      startsAt: null,
      endsAt: null,
      localArea: null,
      latitude: null,
      longitude: null,
      spotsTotal: null,
    }))
  }
}
