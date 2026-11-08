# Next steps: a step-by-step guide (written 2026-11-08)

This guide is for whoever builds the next parts of GreenHands BC, human or AI. Do the steps **in order**. Each step says who does it, what must be true before you start, exactly what to do, how to check it worked, and what to do if it didn't.

The big picture is in [plan.md](../plan.md). Read plan.md section 0 ("Product direction") once before step 1. You don't need the rest of plan.md unless a step points to it.

---

## Rules for every step

1. **Never commit secrets.** The files `env` and `.env` at the repo root hold the database password. They are gitignored. Never `git add` them, never paste their contents into code, chat, commits or PRs, and never print the password.
2. **One branch and one pull request per step.** Start each step from an up-to-date `main` (`git switch main && git pull`), create the branch named in the step, commit, push, and open a PR. Never push straight to `main`.
3. **Ask the user before anything that writes to the shared database.** Our Postgres is shared by the whole team and by Databricks. Steps that write to it are marked **WRITES TO THE DATABASE**. Show the user the command and wait for a yes.
4. **Never drop or rename** a table or column in Postgres or Databricks, and never delete rows, unless the user asks for that exact thing.
5. **Don't change these, which Databricks depends on:** columns `id, h3_r9, category, done_at` on `events`, columns `issue_id, value` on `votes`, all `gold_*` tables, and anything in `databricks/`.
6. **Check before you claim it works.** Every step has a **Check**. Run it and read the output. If the check fails, stop, follow **If it fails**, and tell the user exactly what you saw.
7. **Copy, don't retype.** Ready-made files for steps 4–8 are in `docs/next-steps/app/` and were tested on 2026-11-08. Copy them to the paths given.
8. **Look at the database any time** with the read-only script (it only runs `SELECT`s):
   ```bash
   python docs/next-steps/check_db.py
   ```
   It needs `pip install "psycopg[binary]"` once.

---

## What exists right now

| Thing | State on 2026-11-08 |
|---|---|
| `app/` | TypeScript ingest by a teammate: `scripts/ingest.ts`, `scripts/load-311-history.ts`, `scripts/migrate.ts`, `lib/db.ts`, `db/migrations/001_ingest.sql`. It loads Vancouver open data into Postgres. `001_ingest.sql` matches the live database (checked 2026-11-08) |
| Postgres tables | `raw_311_requests` (about 1.35 million rows, 2022-01 to 2026-11, fully loaded), `road_projects`, `local_areas`, `ingest_state`, `events` (empty, 4 columns), `votes` (empty, 2 columns), and the `gold_*` tables filled by Databricks |
| `frontend/` | Not on `main` yet. It's on branch `origin/frontend-mock`: a Vite + React app with a home feed that uses mock data. Its `src/api/client.ts` already calls `GET /issues`, `GET /events`, `POST/DELETE /issues/:id/me-too` and `POST/DELETE /events/:id/going` |
| `databricks/` | Done and deployed. Builds the `gold` tables and copies the ones the app needs into Postgres `gold_*` tables (`publish_gold`, part of the `bbb_daily` job) |
| API, Auth0, agent | Not started |

**Decisions already made (don't revisit):**
- The frontend is **React** (the Vite app in `frontend/`).
- The **ingest owns every Postgres table.** All tables are created by migration files in `app/db/migrations/`, run by `npm --prefix app run db:migrate`.
- The **API lives in `app/server/`**, next to the ingest, reusing `app/lib/db.ts`. It uses **Express 5** and listens on **port 8000**. The frontend's dev server forwards `/api/*` to it.

---

## Step 1: Set up your copy of the repo

- **Who:** anyone starting work
- **Before you start:** Git, Node.js 20 or newer, Python 3.11 or newer.
- **Do:**
  1. Get the code and switch to `main`:
     ```bash
     git clone https://github.com/bg-06/HackCamp-2026.git
     cd HackCamp-2026
     git switch main
     git pull
     ```
     (If you already have the repo, run only the last two commands.)
  2. Make the database settings file. Copy `env.example` to `env`, then ask a teammate for the real `POSTGRES_PASSWORD` and put it in `env`. The ingest and the API read `.env`, so also copy `env` to `.env`:
     ```bash
     cp env.example env
     ```
     then edit `env`, then:
     ```bash
     cp env .env
     ```
  3. Install the tools:
     ```bash
     npm --prefix app install
     ```
     ```bash
     pip install "psycopg[binary]"
     ```
- **Check:**
  ```bash
  git check-ignore env .env
  ```
  must print both `env` and `.env` (meaning git ignores them). Then:
  ```bash
  python docs/next-steps/check_db.py
  ```
  must list tables including `raw_311_requests`, `events` and `votes`.
- **If it fails:** if `git check-ignore` prints nothing, stop: the secrets file isn't ignored. Tell the user. If `check_db.py` can't connect, the password in `env` is wrong or the server is down; ask the user.

---

## Step 2: Merge the open Databricks PR (DONE)

**Already done on 2026-11-08** (PR #9 merged). Nothing to do; go to step 3.

---

## Step 3: Confirm the ingest code and the 311 load are in place (DONE, re-check only)

**Already done on 2026-11-08:** the ingest owner merged the code that's actually running (PR #13, including a `001_ingest.sql` that matches the live tables, with no PostGIS), and the 311 load finished. Run the read-only checks below to confirm, then go to step 4.

- **Who:** anyone (read-only)
- **Check:**
  ```bash
  git switch main && git pull
  ```
  ```bash
  python docs/next-steps/check_db.py
  ```
  - In the `ingest_state` lines, `3-1-1-service-requests` has a time in its third field (`last_succeeded_at`), not `None`.
  - `raw_311_requests` has about 1.3 million rows.
  - Open `app/db/migrations/001_ingest.sql`: the columns it creates for `raw_311_requests` match the columns `check_db.py` prints for it (currently `id, department, …, fetched_at`).
- **If it fails:** stop and tell the user which of the three checks failed. Don't continue to step 4.

---

## Step 4: Make the migration runner run every migration file

**Why:** today `app/scripts/migrate.ts` only runs `001_ingest.sql`. Steps 5 onward add more migration files, so the runner must run every `.sql` file in `app/db/migrations/` once, in name order, and remember which ones it has run.

- **Who:** anyone, in agreement with the ingest owner (this changes their file)
- **Branch:** `step-4-migration-runner`
- **Before you start:** step 3 is done.
- **Do:**
  1. Replace `app/scripts/migrate.ts` with `docs/next-steps/app/scripts/migrate.ts` (copy the whole file over it).
  2. **WRITES TO THE DATABASE.** `001_ingest.sql` is already applied to the database, so record it as applied without running it again:
     ```bash
     npm --prefix app run db:migrate -- --mark-applied 001_ingest.sql
     ```
     Expected output ends with: `marked  001_ingest.sql as applied (not run)`.
  3. Run the migrations; nothing should be applied, because there's only `001`:
     ```bash
     npm --prefix app run db:migrate
     ```
- **Check:** the last command prints `skip    001_ingest.sql (already applied)` and `Database migration complete`. `python docs/next-steps/check_db.py` prints `applied migrations: ['001_ingest.sql']`.
- **If it fails:** if it says it *applied* `001_ingest.sql` or shows an SQL error, stop and show the user the full output.
- **Finish:** commit `app/scripts/migrate.ts`, push, open a PR titled "Run every migration file once, in order".

---

## Step 5: Add the app tables and the gold tables

**Why:** the app needs tables for RSVPs, organisations, comments, area posts and follows, plus more columns on `events` and `votes`. The `gold_*` tables (filled by Databricks) also become part of the ingest's migrations, because the ingest owns all tables.

- **Who:** anyone
- **Branch:** `step-5-app-tables`
- **Before you start:** step 4 is merged.
- **Do:**
  1. Copy `docs/next-steps/app/db/migrations/002_app.sql` to `app/db/migrations/002_app.sql`. Read its comments: it only adds things (`IF NOT EXISTS`), never removes or renames.
  2. Copy `databricks/postgres/gold_tables.sql` to `app/db/migrations/003_gold_tables.sql`, unchanged. (Databricks runs the same statements; they're all `IF NOT EXISTS`, so running both is safe.)
  3. **WRITES TO THE DATABASE.** Apply them:
     ```bash
     npm --prefix app run db:migrate
     ```
- **Check:**
  - Output shows `applied 002_app.sql`, then `applied 003_gold_tables.sql`, then `Database migration complete`.
  - Run it a second time: both now say `skip … (already applied)`.
  - `python docs/next-steps/check_db.py` lists `comments`, `follows`, `org_members`, `orgs`, `posts`, `rsvps`, `gold_area_summaries`, `gold_event_impact`, `gold_help_hotspots`, `gold_hotspots_h3`, `gold_published`, `gold_track2_issues`, `gold_type_categories`. `events` still starts with `id, h3_r9, category, done_at` and now has more columns; `votes` is `issue_id, value, user_id, created_at`.
- **If it fails:** a failed migration file is rolled back automatically (each file runs in one transaction). Show the user the error. Don't edit `001_ingest.sql`.
- **Finish:** commit both new files, push, PR "Add app tables and gold tables migrations".

---

## Step 6: Load the sample volunteer events

- **Who:** anyone
- **Branch:** `step-6-seed-events`
- **Before you start:** step 5 is merged.
- **Do:**
  1. Copy `docs/next-steps/app/scripts/seed-events.ts` to `app/scripts/seed-events.ts`.
  2. In `app/package.json`, inside `"scripts"`, add this line:
     ```json
     "db:seed-events": "tsc && node dist/scripts/seed-events.js",
     ```
  3. **WRITES TO THE DATABASE.**
     ```bash
     npm --prefix app run db:seed-events
     ```
     It loads `data/seed/volunteer_events.json` if that file exists, otherwise `data/seed/volunteer_events.sample.json` (7 sample events). Running it again updates the same rows; it doesn't duplicate them.
- **Check:** output says `Seeded 7 events from …volunteer_events.sample.json`. `check_db.py` shows `events` with 7 rows.
- **If it fails:** an error mentioning a missing column means step 5 wasn't applied; go back to step 5.
- **Finish:** commit `app/scripts/seed-events.ts` and `app/package.json`, push, PR "Seed volunteer events".

---

## Step 7: Add test data for the gold tables (development only)

**Skip this step if the gold tables already have real data:** run `python docs/next-steps/check_db.py`; if `gold_track2_issues` has rows, Databricks has already published and you don't need fake data. Go to step 8 (its checks then show real issues instead of the 4 test ones).

**Why:** until Databricks publishes, the `gold_*` tables are empty, and the frontend needs something to show. This adds 4 fake Track 2 issues, 3 help hotspots, 7 map cells and 2 area summaries in real Vancouver locations. The first real publish replaces them automatically.

- **Who:** anyone
- **Branch:** `step-7-gold-fixtures`
- **Before you start:** step 5 is merged.
- **Do:**
  1. Copy `docs/next-steps/app/scripts/run-sql.ts` to `app/scripts/run-sql.ts`.
  2. Copy `docs/next-steps/app/db/dev/gold_fixtures.sql` to `app/db/dev/gold_fixtures.sql` (create the `dev` folder).
  3. In `app/package.json` `"scripts"`, add:
     ```json
     "db:fixtures": "tsc && node dist/scripts/run-sql.js db/dev/gold_fixtures.sql",
     ```
  4. **WRITES TO THE DATABASE.** Each insert only runs if its table is empty, so it never mixes with real data:
     ```bash
     npm --prefix app run db:fixtures
     ```
- **Check:** output says `Ran db/dev/gold_fixtures.sql`. `check_db.py` shows `gold_track2_issues` 4 rows, `gold_help_hotspots` 3, `gold_hotspots_h3` 7, `gold_area_summaries` 2. Running it again changes nothing.
- **If it fails:** "relation gold_… does not exist" means step 5 wasn't applied.
- **Finish:** commit the two files and `app/package.json`, push, PR "Add dev fixtures for gold tables".

---

## Step 8: Build the API the frontend already expects

- **Who:** anyone
- **Branch:** `step-8-api`
- **Before you start:** steps 5–7 are merged.
- **Do:**
  1. Install Express:
     ```bash
     npm --prefix app install express@5
     ```
     ```bash
     npm --prefix app install -D @types/express@5
     ```
  2. Copy `docs/next-steps/app/server/index.ts` to `app/server/index.ts`.
  3. In `app/tsconfig.json`, change the `"include"` line to:
     ```json
     "include": ["lib/**/*.ts", "scripts/**/*.ts", "server/**/*.ts"]
     ```
  4. In `app/package.json` `"scripts"`, add:
     ```json
     "api": "tsc && node dist/server/index.js",
     ```
  5. Start it (it keeps running; use a second terminal for the checks):
     ```bash
     npm --prefix app run api
     ```
- **What it serves** (read `app/server/index.ts`; the comments explain each part):

  | Method and path | Returns / does |
  |---|---|
  | `GET /health` | `{"ok":true}` if the database answers |
  | `GET /issues` | Track 2 issues from `gold_track2_issues`, shaped as `IssuePost` from `frontend/src/types.ts`. `meToo` counts up-votes in `votes` |
  | `GET /events` | Upcoming events from `events`, shaped as `EventPost`. `going` counts `rsvps` |
  | `POST` / `DELETE /issues/:id/me-too` | Adds / removes the user's up-vote (one per user per issue) |
  | `POST` / `DELETE /events/:id/going` | Adds / removes the user's RSVP |

  Until Auth0 (step 10), the user is taken from an `X-Demo-User` header, or `demo-user` if there isn't one. That's marked TEMPORARY in the code.
- **Check** (in a second terminal):
  ```bash
  curl -s localhost:8000/health
  ```
  prints `{"ok":true}`.
  ```bash
  curl -s localhost:8000/issues
  ```
  prints a JSON list with 4 issues (titles like "Pothole", "Street Light Out").
  ```bash
  curl -s localhost:8000/events
  ```
  prints the upcoming sample events (if all sample events are in the past, the list is empty; that's fine).
  ```bash
  curl -s -X POST -w "%{http_code}\n" localhost:8000/issues/fixture-issue-1/me-too
  ```
  prints `204`, and then `curl -s localhost:8000/issues` shows `"meToo":1` on `fixture-issue-1`. Undo it with the same command using `-X DELETE`.
- **If it fails:** `{"error":"internal error"}` means a query failed; the terminal running the API shows the real error. "relation … does not exist" means a migration step was skipped.
- **Finish:** stop the API (Ctrl+C), commit `app/server/index.ts`, `app/tsconfig.json`, `app/package.json`, `app/package-lock.json`, push, PR "Add API for the frontend".

---

## Step 9: Connect the React frontend to the API

- **Who:** the frontend owner, or anyone with their OK (it merges their branch)
- **Branch:** `step-9-frontend`
- **Before you start:** step 8 is merged.
- **Do:**
  1. Bring the frontend onto `main`: open a PR from `frontend-mock` into `main` on GitHub, check it only adds the `frontend/` folder, and merge it. Then `git switch main && git pull`.
  2. Create the branch `step-9-frontend`. In `frontend/package.json`, change `"name": "scholarreel-frontend"` to `"name": "greenhands-bc-frontend"`.
  3. Install and configure:
     ```bash
     npm --prefix frontend install
     ```
     ```bash
     cp frontend/.env.example frontend/.env
     ```
     In `frontend/.env`, set `VITE_USE_MOCK=false`.
  4. Start both, each in its own terminal:
     ```bash
     npm --prefix app run api
     ```
     ```bash
     npm --prefix frontend run dev
     ```
- **Check:** open the address Vite prints (usually http://localhost:5173).
  - The Issues tab shows the 4 test issues; the Events tab shows the upcoming sample events.
  - Click "Me too" on an issue, reload the page: it's still counted.
  - Click "Going" on an event, reload: still counted.
  - `git status` must **not** list `frontend/.env`. If it does, add `.env` to `frontend/.gitignore` before committing.
- **If it fails:** open the browser's developer tools, Network tab. Requests to `/api/...` failing with 502/504 mean the API isn't running on port 8000.
- **Finish:** commit the package rename, push, PR "Use the real API in the frontend".

---

## Step 10: Add Auth0 sign-in

- **Who:** the Auth0 owner. Parts 1–3 happen in the Auth0 dashboard and need a person with the Auth0 account; an AI should give the user these steps to do.
- **Branch:** `step-10-auth0`
- **Before you start:** step 9 is merged.
- **Do:**
  1. **Auth0 dashboard: Application.** Applications → Create Application → name `blockbyblock-web`, type **Single Page Application**. In its settings set Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins to `http://localhost:5173` (add the deployed URL later). Under Connections, turn on Google.
  2. **Auth0 dashboard: API.** Applications → APIs → Create API → name `GreenHands BC API`, identifier `https://api.blockbyblock`.
  3. Note the Auth0 domain (like `something.us.auth0.com`), the application's Client ID, and the API identifier. These aren't secret, but keep them in `.env` files, not in code.
  4. **Frontend:**
     ```bash
     npm --prefix frontend install @auth0/auth0-react
     ```
     In `frontend/.env` (and `frontend/.env.example` with empty values) add `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE=https://api.blockbyblock`. In `frontend/src/main.tsx`, wrap `<App />` in `<Auth0Provider domain=… clientId=… authorizationParams={{ redirect_uri: window.location.origin, audience: … }}>`. In `frontend/src/api/client.ts`, add a way to pass an access token (from `getAccessTokenSilently()`) and send it as `Authorization: Bearer <token>` on the POST and DELETE calls. Add a sign-in / sign-out button to the profile page.
  5. **API:**
     ```bash
     npm --prefix app install jose
     ```
     Add `AUTH0_ISSUER=https://<your-domain>/` and `AUTH0_AUDIENCE=https://api.blockbyblock` to the repo-root `.env` and `env.example`. In `app/server/index.ts`, replace the TEMPORARY `userId()` with a check that verifies the Bearer token using `jose` (`createRemoteJWKSet(new URL(AUTH0_ISSUER + '.well-known/jwks.json'))` and `jwtVerify(token, jwks, { issuer, audience })`) and returns `payload.sub`. The four POST/DELETE routes must return `401` with no valid token. GET routes stay public.
- **Check:**
  - Signed out: the feed still loads. Clicking "Me too" asks you to sign in.
  - Signed in with Google: "Me too" works, and the row in `votes` has a `user_id` starting with `google-oauth2|`.
  - `curl -s -X POST -w "%{http_code}\n" localhost:8000/issues/fixture-issue-1/me-too` (no token) prints `401`.
- **If it fails:** "Callback URL mismatch" means the URLs in part 1 don't exactly match the browser address.
- **Finish:** commit, push, PR "Add Auth0 sign-in". Never commit `.env` files.

Plan.md section 7 has the later Auth0 work: roles (`org_admin`, `moderator`) and the machine token for the agent. Do those in step 13 when they're needed.

---

## Step 11: Build the remaining screens

- **Who:** frontend owner, with someone adding API endpoints
- **Before you start:** step 10 is merged.
- **Do these in order, one branch and PR each.** The screen descriptions are in plan.md section 0, "Screens" and "Volunteer card". For each screen: add the API endpoint first (in `app/server/index.ts`, following the pattern of `GET /issues`), check it with `curl`, then build the page, using a function in `frontend/src/api/client.ts`.
  1. **Map** (`/map`): API `GET /hotspots` returns rows from `gold_hotspots_h3`. Frontend: `npm --prefix frontend install maplibre-gl @deck.gl/core @deck.gl/layers @deck.gl/geo-layers @deck.gl/mapbox`; draw an `H3HexagonLayer` with one colour for `track = 'neighbours'` and another for `'city'`, on OpenFreeMap tiles. Add a list view toggle for phones and screen readers.
  2. **Area page** (`/area/:name`): API `GET /areas/:name` returns that area's summary (`gold_area_summaries`), its help hotspots (`gold_help_hotspots`) and upcoming events (`events`). Frontend: weekly summary, "Ways to help this week" (event cards), "Needs help" (hotspots).
  3. **Event page** (`/events/:id`) with comments: API `GET /events/:id`, `GET /events/:id/comments`, `POST /events/:id/comments` (signed in; body 1–2000 characters). Refresh comments every 10 seconds.
  4. **Vote page** (`/area/:name/fix`): API `GET /areas/:name/issues` returns that area's `gold_track2_issues` with `up`, `down` and `score = base_score + 3 * (up - down)`, sorted by score; `POST /issues/:id/vote` with body `{"value": 1}` or `{"value": -1}` (upsert, like me-too). "Send this list to Council" is a `mailto:` link with the top 5 issues.
  5. **Create event** (`/events/new?hotspot=…`): API `POST /events` (signed in) inserts into `events` with `kind = 'hotspot'`, `created_by` = the user id, and `h3_r9`, `category`, `local_area` copied from the hotspot. Then mark-done: `POST /events/:id/done` (host only) sets `done_at`, `people_count`, `bags_collected`.
- **Check (each screen):** the page works at phone width (about 375 px) and desktop width, and works with test data from step 7.

---

## Step 12: Seed organisations from open data

- **Who:** the ingest owner (it's an ingest job)
- **Before you start:** step 5 is merged.
- **Do:** add an ingest command that loads these Vancouver Open Data datasets into `orgs`, setting `source_dataset` to the dataset id and `source_key` to the record id, upserting on `(source_dataset, source_key)`: `community-centres`, `business-improvement-areas-bia`, `community-gardens-and-food-trees`, `free-and-low-cost-food-programs`, `schools`, `libraries`. Fill `local_area` from the record, or from the `local_areas` table by location.
- **Check:** `check_db.py` shows `orgs` with a few hundred rows; running the command twice doesn't change the count.

---

## Step 13: Block Steward agent (Gemini prize)

- **Who:** agent owner. Plan.md section 8 has the details.
- **Before you start:** step 11 parts 1–2 are done. Auth0 machine-to-machine app `block-steward-agent` with scopes `briefings:post` and `suggestions:post` is created (plan.md section 7).
- **Do:** a Python program in `agent/` that runs on a schedule:
  1. Daily: read `gold_help_hotspots` and upcoming `events` from Postgres (read-only). For hotspots with no event in the same `h3_r9` in the next 14 days, write a suggestion for the nearest orgs.
  2. Weekly: write a short "ways to help this week" briefing per area using Gemini, from `gold_area_summaries`, upcoming events and the top Track 2 issues.
  3. Post both through new API endpoints `POST /agent/suggestions` and `POST /agent/briefings`, which insert into `posts` and require an Auth0 machine token with the matching scope.
- **Check:** run it once: the agent finds a hotspot with nothing planned and posts a suggestion that an org admin can accept.

---

## Step 14: Event-impact refresh (Databricks jobs, no n8n)

We don't use n8n. All scheduled work runs as Databricks jobs.

- **Who:** Roshan (Databricks owner) with the API owner.
- **Before you start:** step 11 part 5 is done (`POST /events/:id/done` sets `done_at`).
- **How it works:** the app writes completed events to Postgres. The `bbb_refresh_rankings` job runs every 15 minutes, recomputes rankings and event impact, and publishes them back to the `gold_*` tables. For an immediate refresh during the demo, run `databricks bundle run bbb_refresh_rankings` from `databricks/`.
- **Check:** mark an event done, wait for the next successful run (or trigger one), then run `python databricks/operations/verify_event_impact.py --event-id <id>`.

---

## Step 15: Finish the Databricks side

- **Who:** Roshan (Databricks owner). Not for anyone else.
- **Before you start:** step 3 is done (all 311 data loaded) and step 5 is merged.
- **Do:**
  1. Remove the table creation from `databricks/notebooks/publish_gold.py` (the `DDL_PATH` part), since step 5 made the ingest create the `gold_*` tables.
  2. Run `bbb_daily` (`cd databricks && databricks bundle run bbb_daily`) and check the `gold_*` tables in Postgres hold data for all of Vancouver. (First full run done 2026-11-08 after the full 311 load: `gold_track2_issues` 3,846, `gold_hotspots_h3` 1,211, `gold_help_hotspots` 1,634, `gold_type_categories` 256, `gold_area_summaries` 22. Run it again after item 1.)
  3. Unpause the `bbb_daily` schedule.
  4. Re-check the Track 1 request types against the full data, and build the AI/BI dashboard and Genie space by following `databricks/dashboards/README.md` and `databricks/genie/instructions.md`.

---

## Prompts to start a new chat

Paste one of these, filling in the step number:

- "Read docs/next-steps.md, especially 'Rules for every step'. Then do step N exactly as written. Before any command marked WRITES TO THE DATABASE, show it to me and wait for my yes. Run every Check and show me the output."
- "Read docs/next-steps.md. Run `python docs/next-steps/check_db.py` and tell me which step we're up to, based on each step's Check."
