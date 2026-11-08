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
  startsAt: string // ISO with offset, e.g. 2026-11-15T10:00:00-08:00
  endsAt: string
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
  down_votes: number
  my_vote: Vote // the current user's vote
  lat?: number // centre of the H3 cell
  lng?: number
  popularity?: number // how many people searched for or opened it
}

export type Vote = -1 | 0 | 1

// Home sort options. "longest" (open the longest) is Issues only.
export type SortKey = 'recommended' | 'newest' | 'popular' | 'distance' | 'longest'

export interface LatLng {
  lat: number
  lng: number
}

// Forum: one board per neighbourhood. Stored in the app's Postgres (tables forum_posts, forum_replies).
// resident = any signed-in person; org = posted by a verified org admin; agent = the Block Steward's weekly briefing.
export type AuthorKind = 'resident' | 'org' | 'agent'

export interface ForumPost {
  id: string
  localArea: string
  title: string
  body: string // plain text, never HTML
  author: string // display name: first name + last initial, or the org's name
  authorKind: AuthorKind
  createdAt: string // ISO
  replyCount: number
  linkedEventId?: string // a VolunteerEvent this post is about
  sample: boolean
}

export interface ForumReply {
  id: string
  postId: string
  body: string
  author: string
  authorKind: AuthorKind
  createdAt: string
}

export type FeedTab = 'help' | 'fix'
