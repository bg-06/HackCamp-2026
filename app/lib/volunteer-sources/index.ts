import { CityCuratedAdapter } from './city-curated.js'
import { GreenTeamsOpportunitiesAdapter } from './green-teams-opportunities.js'
import type { VolunteerSourceAdapter } from './types.js'

export const volunteerSources: VolunteerSourceAdapter[] = [
  new CityCuratedAdapter(),
  new GreenTeamsOpportunitiesAdapter(),
]

export type { VolunteerListing, VolunteerSourceAdapter } from './types.js'
