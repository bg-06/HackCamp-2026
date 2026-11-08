import { communityOpportunitySources } from './community-opportunities.js'
import { MeetupPublicPageAdapter } from './meetup.js'
import { GreenTeamsOpportunitiesAdapter } from './green-teams-opportunities.js'
import type { VolunteerSourceAdapter } from './types.js'

export function volunteerSources(): VolunteerSourceAdapter[] { return [
  new GreenTeamsOpportunitiesAdapter(),
  ...(process.env.ENABLE_MEETUP_COLLECTOR === 'true' ? [new MeetupPublicPageAdapter('https://www.meetup.com/the-lower-mainland-green-team/', 'Lower Mainland Green Team')] : []),
  ...communityOpportunitySources,
] }

// Sources intentionally removed from the public feed. Ingestion soft-withdraws their old rows.
export const retiredVolunteerSourceIds = ['vancouver-city-volunteer-programs']

export type { VolunteerListing, VolunteerSourceAdapter } from './types.js'
