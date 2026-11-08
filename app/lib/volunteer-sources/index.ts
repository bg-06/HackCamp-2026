import { CityCuratedAdapter } from './city-curated.js'
import { communityOpportunitySources } from './community-opportunities.js'
import { GreenTeamsOpportunitiesAdapter } from './green-teams-opportunities.js'
import type { VolunteerSourceAdapter } from './types.js'

export const volunteerSources: VolunteerSourceAdapter[] = [
  new CityCuratedAdapter(),
  new GreenTeamsOpportunitiesAdapter(),
  ...communityOpportunitySources,
]

export type { VolunteerListing, VolunteerSourceAdapter } from './types.js'
