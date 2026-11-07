// Data shapes for the home feed. Keep in sync with the backend once it exists.

export type IssueCategory = 'roads' | 'graffiti' | 'garbage' | 'lighting' | 'trees' | 'water'
export type EventCategory = 'cleanup' | 'meetup' | 'garden' | 'city'

// Controls how tall the card's cover is, so the two-column feed looks staggered.
export type CoverSize = 'short' | 'medium' | 'tall'

export interface IssuePost {
  kind: 'issue'
  id: string
  title: string
  category: IssueCategory
  location: string
  area: string // Vancouver local area, e.g. "Mount Pleasant"
  daysOpen: number
  meToo: number // neighbours who said "me too"
  cover: CoverSize
}

export interface EventPost {
  kind: 'event'
  id: string
  title: string
  category: EventCategory
  location: string
  area: string
  date: string // YYYY-MM-DD
  time: string // e.g. "10:00 am"
  going: number
  linkedIssues?: number // open issues this event is about
  cover: CoverSize
}

export type Post = IssuePost | EventPost
export type FeedTab = 'issues' | 'events'
