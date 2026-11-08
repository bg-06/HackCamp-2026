# Block by Block — frontend

React + TypeScript + Vite. Mobile-first. Three tabs in the bottom nav:

- **Volunteer** (`/`, green, Track 1): ways to help, run by the City, local groups and neighbours
- **Issues** (`/issues`, deep blue, Track 2): City-only issues, voted up or down, with "Send the top 5 to Council"
- **Profile** (`/me`, charcoal): what you signed up for, your votes, your volunteer hours and a CSV download of them

Volunteer is a two-column, photo-first feed, with a **Needs help** list above it: spots that keep getting
reported and have nothing planned, each with **Start one**, which opens `/volunteer/new?hotspot=…` prefilled.
Issues is a plain list, one row each, with the vote on the right. Its order stays put while you vote, so a
row doesn't jump away; it re-sorts when you come back.

Under each title: **Near me** (turns on location, for distances and "Nearest") and **Sort: …**
(For you / Newest / Popular / Nearest, plus Longest unsolved on Issues). Only Vancouver has data so far.

Tapping a card opens its page, `/volunteer/:id` or `/issues/:id`: the details, **Where** (a small map and a
Directions link) and the **Discussion**. The one action (sign up, or vote) is pinned to the bottom.

Voting, signing up, commenting and starting an event ask you to sign in first, then carry on with what you
tapped. In mock mode "Sign in" is a sample that needs no account.

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
  lib/geo.ts                   Vancouver, distance
  lib/cover.ts                 card cover shapes, request type wording
  lib/comments.ts              author labels, "3h ago" times, length limit
  lib/hours.ts                 hours formatting and the CSV download
  components/TopBar.tsx        page title, search button
  components/BottomNav.tsx     Volunteer / Issues / Profile
  components/MasonryFeed.tsx   two-column feed
  components/EventTile.tsx     a volunteer card in the feed
  components/IssueRow.tsx      one issue in the list, with the vote beside it
  components/VoteControl.tsx   ▲ score ▼
  components/SignInPrompt.tsx  "Sign in to vote" sheet; runs what you tapped after sign-in
  components/VolunteerCard.tsx top of a volunteer page: the details
  components/VolunteerAction.tsx the sign-up button, pinned to the bottom
  components/PlaceSection.tsx  "Where": place, map, directions
  components/MapPreview.tsx    MapLibre map (lazy-loaded, OpenFreeMap tiles)
  components/Discussion.tsx    comments and the comment form
  state/FeedProvider.tsx       lists, location, sort, search and scroll, kept while you open cards and come back
  state/feed.ts                useFeed() and its types
  pages/HomePage.tsx           both feeds; the route picks which one
  pages/VolunteerPage.tsx      one volunteer opportunity
  pages/NewEventPage.tsx       start an event from a hotspot
  pages/IssuePage.tsx          one issue
  pages/ProfilePage.tsx        sign-ups, votes, volunteer hours
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

1. Configure the root `.env` with the Postgres connection settings.
2. From `app/`, run `npm run db:migrate`, then `npm run ingest:volunteer-events`, then `npm run api`.
3. In another terminal, run `npm run dev:api` from `frontend/`.
4. In dev, `/api/*` is forwarded to `http://localhost:8000`. Set `VITE_API_BASE` for a deployed API.

| Function | Request | Returns |
|---|---|---|
| `getVolunteerEvents()` | `GET /events` | `VolunteerEvent[]` |
| `getVolunteerEvent(id)` | `GET /events/:id` | `VolunteerEvent`, or `null` on 404 |
| event image | `GET /events/:id/image` | Postgres-backed JPEG, PNG, WebP or GIF |
| `setGoing(id, on)` | `POST` / `DELETE /events/:id/rsvp` | nothing |
| `getHelpHotspots()` | `GET /hotspots` | `HelpHotspot[]` (gold_help_hotspots + cell centre) |
| `createEvent(input)` | `POST /events` with `NewEvent` | `VolunteerEvent` (host = the signed-in user) |
| `getTrack2Issues()` | `GET /issues` | `Track2Issue[]` (`up_votes`/`down_votes` without the current user's vote, which goes in `my_vote`) |
| `getTrack2Issue(id)` | `GET /issues/:id` | `Track2Issue`, or `null` on 404 |
| `setVote(id, value)` | `PUT /issues/:id/vote` with `{ value: 1 or -1 }`, or `DELETE` to clear | nothing |
| `getMyHistory()` | `GET /me/history` | `VolunteerRecord[]`, newest first |
| `getComments(type, id)` | `GET /events/:id/comments` or `/issues/:id/comments` | `Comment[]`, oldest first |
| `addComment(type, id, body)` | `POST` the same path with `{ body }` | `Comment` |

`GET /events` includes `commentCount`, `hotspotId`, and `photoUrl` when an image exists. `GET /issues` includes `comment_count`.

Signing up, voting, commenting and starting an event need sign-in. The author of a comment must come from the session on the
server, never from the request body. Comments are plain text; the page never renders HTML from them.
