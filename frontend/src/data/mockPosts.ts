// Sample posts for the home feed. Replace with real 311 data and app events later.
import type { EventPost, IssuePost } from '../types'

export const ISSUES: IssuePost[] = [
  { kind: 'issue', id: 'i1', title: 'Deep pothole in the bike lane', category: 'roads', location: 'E 10th Ave and Main St', area: 'Mount Pleasant', daysOpen: 23, meToo: 12, cover: 'tall' },
  { kind: 'issue', id: 'i2', title: 'Graffiti on the community mural', category: 'graffiti', location: 'Main St and E 7th Ave', area: 'Mount Pleasant', daysOpen: 16, meToo: 7, cover: 'medium' },
  { kind: 'issue', id: 'i3', title: 'Mattress dumped in the lane', category: 'garbage', location: 'Lane behind Kingsway', area: 'Kensington-Cedar Cottage', daysOpen: 9, meToo: 3, cover: 'short' },
  { kind: 'issue', id: 'i4', title: 'Street light out for two weeks', category: 'lighting', location: 'W 4th Ave and Vine St', area: 'Kitsilano', daysOpen: 14, meToo: 9, cover: 'medium' },
  { kind: 'issue', id: 'i5', title: 'Fallen branch blocking the sidewalk', category: 'trees', location: 'Commercial Dr and E 1st Ave', area: 'Grandview-Woodland', daysOpen: 4, meToo: 5, cover: 'tall' },
  { kind: 'issue', id: 'i6', title: 'Catch basin flooding at the crosswalk', category: 'water', location: 'Fraser St and E 41st Ave', area: 'Sunset', daysOpen: 6, meToo: 4, cover: 'short' },
  { kind: 'issue', id: 'i7', title: 'Cracked sidewalk near the school', category: 'roads', location: 'Knight St and E 33rd Ave', area: 'Kensington-Cedar Cottage', daysOpen: 31, meToo: 15, cover: 'medium' },
  { kind: 'issue', id: 'i8', title: 'Overflowing bins at the park', category: 'garbage', location: 'Trout Lake Park', area: 'Kensington-Cedar Cottage', daysOpen: 2, meToo: 6, cover: 'tall' },
]

export const EVENTS: EventPost[] = [
  { kind: 'event', id: 'e1', title: 'Graffiti cleanup on Main St', category: 'cleanup', location: 'Main St and E 7th Ave', area: 'Mount Pleasant', date: '2026-11-14', time: '10:00 am', going: 18, linkedIssues: 7, cover: 'tall' },
  { kind: 'event', id: 'e2', title: 'Neighbourhood meetup', category: 'meetup', location: 'Mount Pleasant Community Centre', area: 'Mount Pleasant', date: '2026-11-17', time: '6:00 pm', going: 24, cover: 'medium' },
  { kind: 'event', id: 'e3', title: 'Fall bulb planting', category: 'garden', location: 'Grandview Park', area: 'Grandview-Woodland', date: '2026-11-15', time: '1:00 pm', going: 11, cover: 'short' },
  { kind: 'event', id: 'e4', title: 'Public hearing on street safety', category: 'city', location: 'Vancouver City Hall', area: 'Mount Pleasant', date: '2026-11-19', time: '6:00 pm', going: 32, linkedIssues: 12, cover: 'medium' },
  { kind: 'event', id: 'e5', title: 'Lane litter pickup', category: 'cleanup', location: 'Lanes off Kingsway', area: 'Kensington-Cedar Cottage', date: '2026-11-21', time: '9:30 am', going: 9, linkedIssues: 4, cover: 'tall' },
  { kind: 'event', id: 'e6', title: 'Kits block party planning', category: 'meetup', location: 'Kitsilano Community Centre', area: 'Kitsilano', date: '2026-11-22', time: '7:00 pm', going: 14, cover: 'short' },
]
