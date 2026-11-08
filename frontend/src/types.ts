// Data shapes for the app. Keep in sync with the backend.
//
// VolunteerEvent matches data/seed/volunteer_events.sample.json (plan.md section 0, "Card data fields").
// Track2Issue matches the Postgres table gold_track2_issues (databricks/postgres/gold_tables.sql),
// plus the vote counts the app adds on top.

// Who runs it: the City, a local org, or a resident/org who started it from a 311 hotspot.
export type EventKind = 'city' | 'org' | 'hotspot'

/** Track 1: a way to help. In-app events have spots; City and org events link out. */
export interface VolunteerEvent {
  id: string
  kind: EventKind
  title: string
  organiser: string
  category: string // same category names as the 311 data (see data/categories.ts)
  startsAt: string | null // null for ongoing programs; otherwise ISO with offset
  endsAt: string | null
  location: string
  localArea: string
  spotsTotal?: number // in-app events only
  spotsTaken?: number
  whatToBring?: string
  signupUrl?: string // external events only. We never take sign-ups for someone else's event
  hotspot?: { requestType: string; timesReported: number; monthsSeen: number } // the "Why here" line
  sample: boolean // true until the listing is confirmed with the organiser

  // Added by the app, not in the seed file:
  lat?: number // missing for events with no fixed place ("any drain near you")
  lng?: number
  createdAt?: string // when it was posted, for "Newest"
  popularity?: number // how many people searched for or opened it, for "Popular"
  photoUrl?: string // e.g. the host's "before" photo; a category cover is shown when missing
  going?: boolean // the current user's RSVP. spotsTaken does NOT count it
  commentCount?: number
  hotspotId?: string // the HelpHotspot it was started from, if any
}

/** Track 2: something only the City can fix. One request type in one H3 cell with open cases. */
export interface Track2Issue {
  issue_id: string
  h3_r9: string
  request_type: string
  category: string
  local_area: string
  address: string | null
  open_cases: number
  days_open: number
  times_reported_12m: number
  base_score: number // from City data only (age + recurrence)
  up_votes: number // everyone's votes, not counting the current user's
  my_vote: Vote // the current user's vote
  lat?: number // centre of the H3 cell
  lng?: number
  popularity?: number // how many people searched for or opened it
  photo_url?: string // a resident's photo of it; 311 data has none
  comment_count?: number
}

/** Track 1 spot that keeps getting reported, from gold_help_hotspots. Can be turned into an event. */
export interface HelpHotspot {
  id: string // h3_r9 + "|" + request_type
  h3_r9: string
  request_type: string
  category: string
  local_area: string
  times_reported: number
  months_seen: number
  last_reported: string
  lat?: number // centre of the H3 cell
  lng?: number
  near?: string // a nearby street, if the backend has one
}

// What the "Start an event" form sends
export interface NewEvent {
  suggestionId?: string
  hotspotId?: string
  title: string
  startsAt: string
  endsAt: string
  location: string
  localArea: string
  category: string
  spotsTotal: number
  whatToBring?: string
  lat?: number
  lng?: number
  hotspot?: VolunteerEvent['hotspot']
}

export type Vote = 0 | 1 // up votes only

// Each person gets 2 new votes per Vancouver day. Taking one back doesn't give it back.
export interface VoteBudget {
  dailyLimit: number
  votesUsed: number
  votesRemaining: number
  voteDate: string // YYYY-MM-DD in Vancouver
  resetsAt: string
}

// Home sort options. "longest" (open the longest) is Issues only.
export type SortKey = 'recommended' | 'newest' | 'popular' | 'distance' | 'longest'

export interface LatLng {
  lat: number
  lng: number
}

// Discussion under each post (a volunteer opportunity or an issue). Stored in the app's `comments` table
// (plan.md section 6), keyed by what it's about.
// resident = any signed-in person; org = a verified org admin; agent = the Block Steward.
export type AuthorKind = 'resident' | 'org' | 'agent'
export type CommentTarget = 'event' | 'issue'

export interface Comment {
  id: string
  targetType: CommentTarget
  targetId: string // VolunteerEvent.id or Track2Issue.issue_id
  body: string // plain text, never HTML
  author: string // display name: first name + last initial, or the org's name
  authorKind: AuthorKind
  createdAt: string // ISO
}

export type FeedTab = 'volunteer' | 'issues'

// Something the current user took part in, for their volunteer hours on Profile
export interface VolunteerRecord {
  id: string
  title: string
  organiser: string
  date: string // ISO
  hours: number
  sample: boolean
}
