# Block by Block 鈥?frontend

React + TypeScript + Vite. Mobile-first app. Home has two tabs that match the two tracks in `plan.md`:

- **Events** (`/`, green, Track 1): volunteer cards for City events, local org events and events started from a 311 hotspot
- **Issues** (`/fix`, maple red, Track 2): City-only issues in one neighbourhood, voted up or down, ranked live, with "Send this list to Council"

Both tabs are a two-column photo feed, with a short intro card at the top. The sort button offers
For you / Newest / Popular / Nearest (plus Longest unsolved on Issues). The location button picks a
city (only Vancouver has data so far) or uses the device's location for "Nearest". Tapping an event
opens `/events/:id` with the full details and the RSVP or sign-up button.

The second bottom tab is the **Forum** (`/forum`, `/forum/:id`): one board per neighbourhood, threads with replies. A thread can be about an event and shows its card.

## Run

```bash
npm install
npm run dev   # http://localhost:5173
```

## Structure

```
src/
  api/client.ts               every backend call (mock or real); backend team starts here
  App.tsx                     routes + bottom nav
  types.ts                    VolunteerEvent (seed file shape), Track2Issue (gold_track2_issues shape)
  data/categories.ts          label, icon and colours per category; "who runs it" labels
  data/mockData.ts            sample events (from data/seed/volunteer_events.sample.json) and Track 2 issues
  data/mockForum.ts           sample forum threads and replies
  lib/issues.ts               live vote score, Van311 link
  lib/sort.ts                 the sort options for each tab
  lib/geo.ts                  cities, distance, nearest city
  lib/cover.ts                stable cover shape per card
  components/MasonryFeed.tsx  two-column feed
  components/EventTile.tsx    photo-first event card (opens the event page)
  components/IssueTile.tsx    photo-first issue card with 鈻?/ 鈻?  components/LocationSheet.tsx bottom sheet: use my location, or pick a city
  pages/EventPage.tsx         one event in full
  lib/forum.ts                author badges, "3h ago" times, length limits
  components/TopBar.tsx       filter button, Events / Issues switch, search button
  components/VolunteerCard.tsx one volunteer opportunity (Track 1)
  pages/HomePage.tsx          Events and Issues tabs; the route picks which one
  pages/ForumPage.tsx         thread list per neighbourhood, new post form
  pages/ForumThreadPage.tsx   one thread, its event card, replies, reply form
  pages/PlaceholderPage.tsx   Map and Profile (not built yet)
  index.css                   all styles; colours are CSS variables at the top
```

Everything shown is sample data for now, and every card says so.

## Rules the UI keeps

- Green means neighbours can help, maple red means only the City can fix it. Nothing else uses those two meanings.
- Every card says who runs it. City and org events show **Sign up on [site] 鈫?* and never take an RSVP in the app.
- "Send this list to Council" opens an email in the resident's own mail app. We don't send it, and we don't claim the City reads votes.

## Connecting the backend

All data goes through `src/api/client.ts`. Pages never fetch on their own.

1. Fill in the parts marked `TODO(backend)` in `src/api/client.ts`.
2. Keep returning the shapes in `src/types.ts`. If your fields are named differently, convert them inside `client.ts`.
3. Copy `.env.example` to `.env` and set `VITE_USE_MOCK=false`.
4. In dev, `/api/*` is forwarded to `http://localhost:8000` (change it in `vite.config.ts`).

| Function | Request | Returns |
|---|---|---|
| `getVolunteerEvents()` | `GET /events` | `VolunteerEvent[]` |
| `getTrack2Issues()` | `GET /issues` | `Track2Issue[]` (`up_votes`/`down_votes` without the current user's vote, which goes in `my_vote`) |
| `setGoing(id, on)` | `POST` / `DELETE /events/:id/rsvp` | nothing |
| `setVote(id, value)` | `PUT /issues/:id/vote` with `{ value: 1 or -1 }`, or `DELETE` to clear | nothing |
| `getForumPosts()` | `GET /forum/posts` | `ForumPost[]`, newest first |
| `getForumThread(id)` | `GET /forum/posts/:id` | `{ post, replies }`, or `null` if not found |
| `createForumPost(input)` | `POST /forum/posts` with `{ localArea, title, body }` | `ForumPost` |
| `createForumReply(id, body)` | `POST /forum/posts/:id/replies` with `{ body }` | `ForumReply` |

Posting and replying need sign-in. The author must come from the session on the server, never from the request body. Post bodies are plain text; the page never renders HTML from them.

The page handles loading, errors (with a "Try again" button), and undoes an RSVP or vote if the request fails.
