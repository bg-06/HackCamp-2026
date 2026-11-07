# Block by Block – frontend

React + TypeScript + Vite. Mobile-first homepage for browsing Vancouver neighbourhood issues and community events.

## Run

```bash
npm install
npm run dev   # http://localhost:5173
```

## Structure

```
src/
  api/client.ts            every backend call (mock or real) – backend team starts here
  App.tsx                  routes + bottom nav
  types.ts                 IssuePost, EventPost
  data/categories.ts       label, icon and colours for each category
  data/mockPosts.ts        sample issues and events (replace with real data)
  components/TopBar.tsx    filter button, Events/Issues switch, search button
  components/PostCard.tsx  one card in the two-column feed
  components/BottomNav.tsx Home / Updates / Map / Profile
  pages/HomePage.tsx       the feed
  pages/PlaceholderPage.tsx  Updates, Map, Profile (not built yet)
  index.css                all styles; colours are CSS variables at the top
```

Everything shown is sample data for now.

## Connecting the backend

All data goes through `src/api/client.ts`. Pages never fetch on their own.

1. Fill in the parts marked `TODO(backend)` in `src/api/client.ts`.
2. Keep returning the shapes in `src/types.ts`. If your fields are named differently (e.g. `local_area`), convert them inside `client.ts`.
3. Copy `.env.example` to `.env` and set `VITE_USE_MOCK=false`.
4. In dev, `/api/*` is forwarded to `http://localhost:8000` (change it in `vite.config.ts`).

| Function | Request | Returns |
|---|---|---|
| `getIssues()` | `GET /issues` | `IssuePost[]` |
| `getEvents()` | `GET /events` | `EventPost[]` |
| `setMeToo(id, on)` | `POST` / `DELETE /issues/:id/me-too` | nothing |
| `setGoing(id, on)` | `POST` / `DELETE /events/:id/going` | nothing |

The home page already handles loading, errors (with a "Try again" button), and undoes a "Me too" or "Join" tap if the request fails.
