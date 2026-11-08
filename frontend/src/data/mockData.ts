// Sample data, shown while VITE_USE_MOCK is not "false".
// VOLUNTEER_EVENTS is copied from data/seed/volunteer_events.sample.json (same fields), except the UTC offset:
// BC stays on UTC-7 all year from 2026 (tz data 2026b), so Vancouver times in Nov 2026 are -07:00, not -08:00.
// TRACK2_ISSUES has the same columns as gold_track2_issues; the ids and H3 cells are made up.
import type { HelpHotspot, Track2Issue, VolunteerEvent, VolunteerRecord } from '../types'

// Same columns as gold_help_hotspots. The first two already have an event, so "Needs help" hides them.
export const HELP_HOTSPOTS: HelpHotspot[] = [
  { id: 'sample-mtp|Illegal Dumping Case', h3_r9: 'sample-mtp', request_type: 'Illegal Dumping Case', category: 'Garbage and Dumping', local_area: 'Mount Pleasant', times_reported: 9, months_seen: 6, last_reported: '2026-11-03T08:10:00-07:00', lat: 49.2625, lng: -123.0985, near: 'Lane behind 300 block E Broadway' },
  { id: 'sample-kits|Loose Litter Clean Up Case', h3_r9: 'sample-kits', request_type: 'Loose Litter Clean Up Case', category: 'Garbage and Dumping', local_area: 'Kitsilano', times_reported: 6, months_seen: 5, last_reported: '2026-10-29T13:00:00-07:00', lat: 49.2683, lng: -123.1556, near: 'W 4th Ave and Yew St' },
  { id: 'sample-gw|Graffiti Removal - City Property Case', h3_r9: 'sample-gw', request_type: 'Graffiti Removal - City Property Case', category: 'Graffiti', local_area: 'Grandview-Woodland', times_reported: 11, months_seen: 7, last_reported: '2026-11-05T17:40:00-07:00', lat: 49.2645, lng: -123.0697, near: 'Commercial Dr and E 6th Ave' },
  { id: 'sample-kcc|Loose Litter Clean Up Case', h3_r9: 'sample-kcc', request_type: 'Loose Litter Clean Up Case', category: 'Garbage and Dumping', local_area: 'Kensington-Cedar Cottage', times_reported: 7, months_seen: 5, last_reported: '2026-11-01T11:20:00-07:00', lat: 49.2495, lng: -123.0773, near: 'Kingsway and Knight St' },
  { id: 'sample-strath|Illegal Dumping Case', h3_r9: 'sample-strath', request_type: 'Illegal Dumping Case', category: 'Garbage and Dumping', local_area: 'Strathcona', times_reported: 8, months_seen: 4, last_reported: '2026-11-06T09:05:00-07:00', lat: 49.2812, lng: -123.0912, near: 'Lane behind 500 block E Hastings St' },
]

// Past volunteering for the sample user's Profile
export const MY_HISTORY: VolunteerRecord[] = [
  { id: 'h1', title: 'Lane cleanup on Fraser St', organiser: 'Sunset neighbours', date: '2026-10-04T10:00:00-07:00', hours: 2, sample: true },
  { id: 'h2', title: 'Cleared 4 catch basins before the rain', organiser: 'Adopt a Catch Basin', date: '2026-10-19T09:00:00-07:00', hours: 1, sample: true },
  { id: 'h3', title: 'Packed food hampers', organiser: 'Strathcona community food program', date: '2026-10-30T16:00:00-07:00', hours: 2.5, sample: true },
]

export const VOLUNTEER_EVENTS: VolunteerEvent[] = [
  {
    id: 'city-cleanup-mtp-1115',
    kind: 'city',
    title: 'City Hosted Cleanup: Main Street',
    organiser: 'City of Vancouver Neighbourhood Cleanup Programs',
    category: 'Litter and Dumping',
    startsAt: '2026-11-15T10:00:00-07:00',
    endsAt: '2026-11-15T12:00:00-07:00',
    location: 'Main St and E Broadway',
    localArea: 'Mount Pleasant',
    whatToBring: 'Gloves and grabbers provided',
    signupUrl: 'https://app.betterimpact.com/PublicOrganization/c6e38574-b5fa-4920-9679-a5ec7c8dd23c/3',
    sample: true,
  },
  {
    id: 'hotspot-dumping-mtp-1116',
    kind: 'hotspot',
    title: 'Clear the dumping spot behind Kingsgate',
    organiser: 'Priya S. (resident)',
    category: 'Litter and Dumping',
    startsAt: '2026-11-16T13:00:00-07:00',
    endsAt: '2026-11-16T15:00:00-07:00',
    location: 'Lane behind 300 block E Broadway',
    localArea: 'Mount Pleasant',
    spotsTotal: 12,
    spotsTaken: 7,
    whatToBring: 'Work gloves. City cleanup supplies requested',
    hotspot: { requestType: 'Illegal Dumping Case', timesReported: 9, monthsSeen: 6 },
    sample: true,
  },
  {
    id: 'catch-basin-mtp-1118',
    kind: 'city',
    title: 'Adopt a Catch Basin before the rains',
    organiser: 'City of Vancouver',
    category: 'Drains and Flooding',
    startsAt: '2026-11-18T09:00:00-07:00',
    endsAt: '2026-11-18T17:00:00-07:00',
    location: 'Any drain near you',
    localArea: 'Mount Pleasant',
    whatToBring: 'A rake. Takes a few minutes per drain',
    signupUrl: 'https://vancouver.ca/people-programs/adopt-a-catch-basin.aspx',
    sample: true,
  },
  {
    id: 'org-graffiti-strath-1122',
    kind: 'org',
    title: 'Graffiti paint-out on Hastings fences',
    organiser: 'Strathcona neighbourhood group',
    category: 'Graffiti',
    startsAt: '2026-11-22T10:00:00-07:00',
    endsAt: '2026-11-22T13:00:00-07:00',
    location: 'E Hastings St and Hawks Ave',
    localArea: 'Strathcona',
    spotsTotal: 10,
    spotsTaken: 10,
    whatToBring: 'Old clothes. Paint and rollers provided',
    hotspot: { requestType: 'Graffiti Removal - Private Property Case', timesReported: 14, monthsSeen: 8 },
    sample: true,
  },
  {
    id: 'park-stewards-kits-1123',
    kind: 'city',
    title: 'Pull invasive ivy with the Park Stewards',
    organiser: 'Vancouver Park Board',
    category: 'Parks and Trees',
    startsAt: '2026-11-23T09:30:00-07:00',
    endsAt: '2026-11-23T12:00:00-07:00',
    location: 'Kitsilano Beach Park',
    localArea: 'Kitsilano',
    whatToBring: 'Training, tools and vests provided',
    signupUrl: 'https://vancouver.ca/files/cov/become-a-park-steward.pdf',
    sample: true,
  },
  {
    id: 'org-food-strath-1120',
    kind: 'org',
    title: 'Sort and pack food hampers',
    organiser: 'Strathcona community food program',
    category: 'Food and Community',
    startsAt: '2026-11-20T16:00:00-07:00',
    endsAt: '2026-11-20T18:30:00-07:00',
    location: 'Strathcona',
    localArea: 'Strathcona',
    spotsTotal: 8,
    spotsTaken: 3,
    sample: true,
  },
  {
    id: 'hotspot-litter-kits-1129',
    kind: 'hotspot',
    title: 'West 4th litter sweep',
    organiser: 'Kits high school volunteer club',
    category: 'Litter and Dumping',
    startsAt: '2026-11-29T11:00:00-07:00',
    endsAt: '2026-11-29T12:30:00-07:00',
    location: 'W 4th Ave and Yew St',
    localArea: 'Kitsilano',
    spotsTotal: 20,
    spotsTaken: 4,
    whatToBring: 'Counts toward school volunteer hours',
    hotspot: { requestType: 'Loose Litter Clean Up Case', timesReported: 6, monthsSeen: 5 },
    sample: true,
  },
]

// App-only fields that the seed file doesn't have: place on the map, when it was posted, made-up popularity.
const EVENT_EXTRAS: Record<string, Partial<VolunteerEvent>> = {
  'city-cleanup-mtp-1115': { lat: 49.2629, lng: -123.1005, createdAt: '2026-11-01T09:00:00-07:00', popularity: 312 },
  'hotspot-dumping-mtp-1116': { lat: 49.2625, lng: -123.0985, createdAt: '2026-11-06T18:20:00-07:00', popularity: 184, hotspotId: 'sample-mtp|Illegal Dumping Case' },
  'catch-basin-mtp-1118': { createdAt: '2026-10-28T10:00:00-07:00', popularity: 96 },
  'org-graffiti-strath-1122': { lat: 49.2811, lng: -123.0889, createdAt: '2026-11-03T12:00:00-07:00', popularity: 241 },
  'park-stewards-kits-1123': { lat: 49.2756, lng: -123.1537, createdAt: '2026-10-30T08:30:00-07:00', popularity: 158 },
  'org-food-strath-1120': { lat: 49.2777, lng: -123.0916, createdAt: '2026-11-05T15:00:00-07:00', popularity: 73 },
  'hotspot-litter-kits-1129': { lat: 49.2683, lng: -123.1556, createdAt: '2026-11-07T11:40:00-07:00', popularity: 129, hotspotId: 'sample-kits|Loose Litter Clean Up Case' },
}
for (const e of VOLUNTEER_EVENTS) Object.assign(e, EVENT_EXTRAS[e.id])

// base_score = least(days_open, 90) / 10 + times_reported_12m, as in gold.track2_issues.
function issue(
  id: string,
  request_type: string,
  category: string,
  local_area: string,
  address: string,
  days_open: number,
  times_reported_12m: number,
  up_votes: number,
  down_votes: number,
  lat: number,
  lng: number,
  popularity: number,
): Track2Issue {
  return {
    issue_id: id,
    h3_r9: `sample-${id}`,
    request_type,
    category,
    local_area,
    address,
    open_cases: 1 + (times_reported_12m % 3),
    days_open,
    times_reported_12m,
    base_score: Math.min(days_open, 90) / 10 + times_reported_12m,
    up_votes,
    down_votes,
    my_vote: 0,
    lat,
    lng,
    popularity,
  }
}

export const TRACK2_ISSUES: Track2Issue[] = [
  issue('t2-mtp-1', 'Pothole Case', 'Roads and Sidewalks', 'Mount Pleasant', 'E 10th Ave and Main St', 23, 6, 12, 1, 49.2619, -123.1007, 420),
  issue('t2-mtp-2', 'Street Light Out Case', 'Lighting and Signals', 'Mount Pleasant', 'E 7th Ave and Quebec St', 14, 3, 9, 0, 49.2641, -123.103, 205),
  issue('t2-mtp-3', 'Sidewalk Repair Case', 'Roads and Sidewalks', 'Mount Pleasant', 'Kingsway and E 12th Ave', 41, 2, 4, 2, 49.2604, -123.0967, 88),
  issue('t2-mtp-4', 'Catch Basin Blocked Case', 'Water and Sewer', 'Mount Pleasant', 'Main St and E 15th Ave', 6, 4, 3, 5, 49.2569, -123.1009, 64),
  issue('t2-mtp-5', 'Abandoned Mattress Case', 'Garbage and Dumping', 'Mount Pleasant', 'Lane behind 200 block E Broadway', 9, 5, 6, 0, 49.2627, -123.0995, 133),
  issue('t2-kits-1', 'Street Light Out Case', 'Lighting and Signals', 'Kitsilano', 'W 4th Ave and Vine St', 14, 2, 9, 1, 49.268, -123.161, 176),
  issue('t2-kits-2', 'Pothole Case', 'Roads and Sidewalks', 'Kitsilano', 'W Broadway and Macdonald St', 30, 4, 7, 3, 49.2638, -123.1683, 298),
  issue('t2-strath-1', 'Street Litter Can Case', 'Garbage and Dumping', 'Strathcona', 'E Hastings St and Princess Ave', 2, 7, 5, 1, 49.2811, -123.0957, 117),
  issue('t2-strath-2', 'Water Main Leak Case', 'Water and Sewer', 'Strathcona', 'Union St and Gore Ave', 3, 1, 2, 0, 49.2777, -123.0975, 59),
]
