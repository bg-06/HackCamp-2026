import type { LatLng, SortKey, Track2Issue, VolunteerEvent } from '../types'
import { distanceTo } from './geo'
import { issueScore } from './issues'

export const EVENT_SORTS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'For you' },
  { key: 'newest', label: 'Newest' },
  { key: 'popular', label: 'Popular' },
  { key: 'distance', label: 'Nearest' },
]

export const ISSUE_SORTS: { key: SortKey; label: string }[] = [
  ...EVENT_SORTS,
  { key: 'longest', label: 'Longest unsolved' },
]

// Things the user has shown interest in. In mock mode that's this session's RSVPs and up-votes.
// TODO(backend): "For you" should come from the user's history on the server (past RSVPs, votes,
// searches), so it works across devices.
function interests(events: VolunteerEvent[], issues: Track2Issue[]) {
  return new Set([
    ...events.filter((e) => e.going).map((e) => e.category),
    ...issues.filter((i) => i.my_vote === 1).map((i) => i.category),
  ])
}

// Compare as times, not strings: "10:00-07:00" vs "09:30-08:00" sorts wrong as text,
// and the seed, the mock data and the backend don't all use the same offset.
const time = (iso?: string) => (iso ? Date.parse(iso) : 0)

// Items with no place go last when sorting by distance.
const byDistance = (from: LatLng) => (a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }) =>
  (distanceTo(from, a) ?? Infinity) - (distanceTo(from, b) ?? Infinity)

export function sortEvents(
  list: VolunteerEvent[],
  sort: SortKey,
  ctx: { from: LatLng; events: VolunteerEvent[]; issues: Track2Issue[] },
) {
  const out = [...list]
  switch (sort) {
    case 'newest':
      return out.sort((a, b) => time(b.createdAt) - time(a.createdAt))
    case 'popular':
      return out.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    case 'distance':
      return out.sort(byDistance(ctx.from))
    default: {
      // For you: categories you care about first, then the soonest
      const liked = interests(ctx.events, ctx.issues)
      return out.sort(
        (a, b) => Number(liked.has(b.category)) - Number(liked.has(a.category)) || time(a.startsAt) - time(b.startsAt),
      )
    }
  }
}

export function sortIssues(
  list: Track2Issue[],
  sort: SortKey,
  ctx: { from: LatLng; events: VolunteerEvent[]; issues: Track2Issue[] },
) {
  const out = [...list]
  switch (sort) {
    case 'newest':
      return out.sort((a, b) => a.days_open - b.days_open)
    case 'longest':
      return out.sort((a, b) => b.days_open - a.days_open)
    case 'popular':
      return out.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    case 'distance':
      return out.sort(byDistance(ctx.from))
    default: {
      // For you: categories you care about first, then the most pressing (live vote score)
      const liked = interests(ctx.events, ctx.issues)
      return out.sort(
        (a, b) => Number(liked.has(b.category)) - Number(liked.has(a.category)) || issueScore(b).score - issueScore(a).score,
      )
    }
  }
}
