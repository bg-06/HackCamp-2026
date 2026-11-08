# Block by Block — frontend

React + TypeScript + Vite. Mobile-first. Three tabs in the bottom nav:

- **Volunteer** (`/`, green, Track 1): ways to help, run by the City, local groups and neighbours
- **Issues** (`/issues`, deep blue, Track 2): City-only issues, voted up or down, with "Send the top 5 to Council"
- **Profile** (`/me`): not built yet

Both feeds are two-column, photo-first cards. The sort button offers For you / Newest / Popular / Nearest
(plus Longest unsolved on Issues). The location button picks a city (only Vancouver has data so far) or
uses the device's location for "Nearest".

Tapping a card opens its page, `/volunteer/:id` or `/issues/:id`, with everything else on it:
the details and the one action (sign up, or vote), **Where** (a small map and a Directions link), and the
**Discussion** (comments). There's no separate forum or map tab.

## Run

```bash
npm install
npm run dev   # http://localhost:5173
```

## Structure

```
src/
  api/client.ts                every backend call (mock or real); backend team starts here
  App.tsx                      routes + bottom nav
  types.ts                     VolunteerEvent (seed file shape), Track2Issue (gold_track2_issues shape), Comment
  data/categories.ts           label, icon and colours per category; "who runs it" labels
  data/mockData.ts             sample volunteer opportunities and Track 2 issues
  data/mockComments.ts         sample comments
  lib/issues.ts                live vote score, Van311 link
  lib/sort.ts                  the sort options for each tab
  lib/geo.ts                   cities, distance, nearest city
  lib/cover.ts                 card cover shapes, request type wording
  lib/comments.ts              author labels, "3h ago" times, length limit
  components/TopBar.tsx        sort button, page title, search button
  components/BottomNav.tsx     Volunteer / Issues / Profile
  components/MasonryFeed.tsx   two-column feed
  components/EventTile.tsx     a volunteer card in the feed
  components/IssueTile.tsx     an issue card in the feed, with the vote
  components/VoteControl.tsx   ▲ score ▼
  components/LocationSheet.tsx bottom sheet: use my location, or pick a city
  components/VolunteerCard.tsx top of a volunteer page: details and sign-up
  components/PlaceSection.tsx  "Where": place, map, directions
  components/MapPreview.tsx    MapLibre map (lazy-loaded, OpenFreeMap tiles)
  components/Discussion.tsx    comments and the comment form
  pages/HomePage.tsx           both feeds; the route picks which one
  pages/VolunteerPage.tsx      one volunteer opportunity
  pages/IssuePage.tsx          one issue
  pages/PlaceholderPage.tsx    Profile (not built yet)
  index.css                    all styles; colours are CSS variables at the top
```

Everything shown is sample data for now, and sample listings say so.

## Rules the UI keeps

- Green means neighbours can help, deep blue means only the City can fix it. Warnings are yellow.
- Every card says who runs it. City and org listings show **Sign up on [site] ↗** and never take a sign-up in the app.
- "Send the top 5 to Council" opens an email in the resident's own mail app. We don't send it, and we don't claim the City reads votes.
- Plain styling on purpose: flat colours, thin borders, text for hierarchy. No gradients, shadows or badge pills.

## Connecting the backend

All data goes through `src/api/client.ts`. Pages never fetch on their own.

1. Fill in the parts marked `TODO(backend)` in `src/api/client.ts`.
2. Keep returning the shapes in `src/types.ts`. If your fields are named differently, convert them inside `client.ts`.
3. Copy `.env.example` to `.env` and set `VITE_USE_MOCK=false`.
4. In dev, `/api/*` is forwarded to `http://localhost:8000` (change it in `vite.config.ts`).

| Function | Request | Returns |
|---|---|---|
| `getVolunteerEvents()` | `GET /events` | `VolunteerEvent[]` |
| `getVolunteerEvent(id)` | `GET /events/:id` | `VolunteerEvent`, or `null` on 404 |
| `setGoing(id, on)` | `POST` / `DELETE /events/:id/rsvp` | nothing |
| `getTrack2Issues()` | `GET /issues` | `Track2Issue[]` (`up_votes`/`down_votes` without the current user's vote, which goes in `my_vote`) |
| `getTrack2Issue(id)` | `GET /issues/:id` | `Track2Issue`, or `null` on 404 |
| `setVote(id, value)` | `PUT /issues/:id/vote` with `{ value: 1 or -1 }`, or `DELETE` to clear | nothing |
| `getComments(type, id)` | `GET /events/:id/comments` or `/issues/:id/comments` | `Comment[]`, oldest first |
| `addComment(type, id, body)` | `POST` the same path with `{ body }` | `Comment` |

Signing up, voting and commenting need sign-in. The author of a comment must come from the session on the
server, never from the request body. Comments are plain text; the page never renders HTML from them.
