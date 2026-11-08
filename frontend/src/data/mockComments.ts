// Sample comments, shown while VITE_USE_MOCK is not "false".
// Mutable on purpose: in mock mode new comments are added here, so they survive moving between pages
// (until the browser reloads).
import type { Comment } from '../types'

export const COMMENTS: Comment[] = [
  {
    id: 'c1',
    targetType: 'event',
    targetId: 'hotspot-dumping-mtp-1116',
    body: 'Anyone have spare work gloves for Sunday? I only have one pair. Happy to pick up near Main and Broadway.',
    author: 'Daniel K.',
    authorKind: 'resident',
    createdAt: '2026-11-07T14:20:00-07:00',
  },
  {
    id: 'c2',
    targetType: 'event',
    targetId: 'hotspot-dumping-mtp-1116',
    body: 'I have two spare pairs, I can bring them Sunday.',
    author: 'Priya S.',
    authorKind: 'resident',
    createdAt: '2026-11-07T15:02:00-07:00',
  },
  {
    id: 'c3',
    targetType: 'event',
    targetId: 'org-graffiti-strath-1122',
    body: "Thanks everyone, this filled up in two days. We're asking the property owners about a second date in early December and will post it here.",
    author: 'Strathcona neighbourhood group',
    authorKind: 'org',
    createdAt: '2026-11-06T16:10:00-07:00',
  },
  {
    id: 'c4',
    targetType: 'event',
    targetId: 'hotspot-litter-kits-1129',
    body: 'Does this count for school volunteer hours?',
    author: 'Sam R.',
    authorKind: 'resident',
    createdAt: '2026-11-04T18:30:00-07:00',
  },
  {
    id: 'c5',
    targetType: 'event',
    targetId: 'hotspot-litter-kits-1129',
    body: 'Yes, the club gives you a signed hours sheet at the end.',
    author: 'Kits high school volunteer club',
    authorKind: 'org',
    createdAt: '2026-11-05T08:15:00-07:00',
  },
  {
    id: 'c6',
    targetType: 'issue',
    targetId: 't2-mtp-2',
    body: "Still out after two weeks. That corner is really dark at night, I'd avoid it walking home.",
    author: 'Mei L.',
    authorKind: 'resident',
    createdAt: '2026-11-05T20:45:00-07:00',
  },
  {
    id: 'c7',
    targetType: 'issue',
    targetId: 't2-mtp-1',
    body: "It's right in the bike lane. I've seen two people swerve into traffic to avoid it.",
    author: 'Chris W.',
    authorKind: 'resident',
    createdAt: '2026-11-06T18:40:00-07:00',
  },
]
