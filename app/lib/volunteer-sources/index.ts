import { CityCuratedAdapter } from './city-curated.js'
import { MeetupPublicPageAdapter } from './meetup.js'
import type { VolunteerSourceAdapter } from './types.js'

export const volunteerSources: VolunteerSourceAdapter[] = [
  new CityCuratedAdapter(),
  new MeetupPublicPageAdapter(
    'https://www.meetup.com/the-lower-mainland-green-team/events/',
    'The Lower Mainland Green Team',
  ),
]

export type { VolunteerListing, VolunteerSourceAdapter } from './types.js'
