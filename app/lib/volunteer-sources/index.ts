import { communityOpportunitySources } from './community-opportunities.js'
import { GreenTeamsOpportunitiesAdapter } from './green-teams-opportunities.js'
import type { VolunteerSourceAdapter } from './types.js'

export const volunteerSources: VolunteerSourceAdapter[] = [
  new GreenTeamsOpportunitiesAdapter(),
  ...communityOpportunitySources,
]

// Sources intentionally removed from the public feed. Ingestion soft-withdraws their old rows.
export const retiredVolunteerSourceIds = ['vancouver-city-volunteer-programs']

export type { VolunteerListing, VolunteerSourceAdapter } from './types.js'
