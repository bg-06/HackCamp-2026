// Sample forum threads, shown while VITE_USE_MOCK is not "false".
// These arrays are mutable on purpose: in mock mode, new posts and replies are added here
// so they survive moving between pages (until the browser reloads).
import type { ForumPost, ForumReply } from '../types'

export const FORUM_POSTS: ForumPost[] = [
  {
    id: 'p-mtp-brief',
    localArea: 'Mount Pleasant',
    title: 'This week in Mount Pleasant',
    body:
      'Illegal dumping is still the top neighbour-fixable issue here: 9 reports in 6 months in the lane behind the 300 block of E Broadway. ' +
      'A resident has started a cleanup there on Sunday, and the City is hosting one on Main St on Saturday.\n\n' +
      'On the City side, the pothole at E 10th Ave and Main St has been open 23 days and is the most voted issue in the area.',
    author: 'Block Steward',
    authorKind: 'agent',
    createdAt: '2026-11-06T09:00:00-08:00',
    replyCount: 2,
    sample: true,
  },
  {
    id: 'p-mtp-gloves',
    localArea: 'Mount Pleasant',
    title: 'Anyone have spare work gloves for Sunday?',
    body: "Joining the Kingsgate lane cleanup on Sunday and I only have one pair. Happy to pick up from anyone near Main and Broadway.",
    author: 'Daniel K.',
    authorKind: 'resident',
    createdAt: '2026-11-07T14:20:00-08:00',
    replyCount: 1,
    linkedEventId: 'hotspot-dumping-mtp-1116',
    sample: true,
  },
  {
    id: 'p-mtp-light',
    localArea: 'Mount Pleasant',
    title: 'Street light on E 7th and Quebec still out',
    body: "It's been two weeks and that corner is really dark at night. I reported it in Van311. If it affects you too, vote it up on the Issues tab so it shows up in the list we send to Council.",
    author: 'Mei L.',
    authorKind: 'resident',
    createdAt: '2026-11-05T20:45:00-08:00',
    replyCount: 0,
    sample: true,
  },
  {
    id: 'p-strath-paint',
    localArea: 'Strathcona',
    title: 'Paint-out on Hastings is full, second date coming',
    body: "Thanks everyone, the Nov 22 paint-out filled up in two days. We're asking the property owners about a second date in early December and will post it here.",
    author: 'Strathcona neighbourhood group',
    authorKind: 'org',
    createdAt: '2026-11-06T16:10:00-08:00',
    replyCount: 1,
    linkedEventId: 'org-graffiti-strath-1122',
    sample: true,
  },
  {
    id: 'p-kits-hours',
    localArea: 'Kitsilano',
    title: 'Do the W 4th litter sweep hours count for school?',
    body: 'My kid needs volunteer hours for grad. Does anyone know if the sweep counts?',
    author: 'Sam R.',
    authorKind: 'resident',
    createdAt: '2026-11-04T18:30:00-08:00',
    replyCount: 1,
    linkedEventId: 'hotspot-litter-kits-1129',
    sample: true,
  },
]

export const FORUM_REPLIES: ForumReply[] = [
  {
    id: 'r1',
    postId: 'p-mtp-brief',
    body: "I'll be at the Saturday one. First time doing this!",
    author: 'Ana P.',
    authorKind: 'resident',
    createdAt: '2026-11-06T12:05:00-08:00',
  },
  {
    id: 'r2',
    postId: 'p-mtp-brief',
    body: 'Thanks for the summary. Is there anything planned for the drains before the rains?',
    author: 'Chris W.',
    authorKind: 'resident',
    createdAt: '2026-11-06T18:40:00-08:00',
  },
  {
    id: 'r3',
    postId: 'p-mtp-gloves',
    body: 'I have two spare pairs, I can bring them Sunday.',
    author: 'Priya S.',
    authorKind: 'resident',
    createdAt: '2026-11-07T15:02:00-08:00',
  },
  {
    id: 'r4',
    postId: 'p-strath-paint',
    body: "Please do, I missed the first one.",
    author: 'Jordan T.',
    authorKind: 'resident',
    createdAt: '2026-11-06T19:30:00-08:00',
  },
  {
    id: 'r5',
    postId: 'p-kits-hours',
    body: 'Yes, the club gives you a signed hours sheet at the end.',
    author: 'Kits high school volunteer club',
    authorKind: 'org',
    createdAt: '2026-11-05T08:15:00-08:00',
  },
]
