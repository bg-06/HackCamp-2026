# Block Steward agent

A small Python agent for Block by Block. It never decides anything for people; it only suggests.

- **Daily suggestions:** finds recurring Track 1 hotspots (`gold_help_hotspots`) with no event planned in the next 14 days, picks the nearest orgs, and drafts an event with the matching City program. Org admins accept (opens Create event, prefilled) or dismiss.
- **Weekly briefings:** one "ways to help this week" post per area. Gemini words it if `GEMINI_API_KEY` is set; otherwise a built-in template does. Graffiti spots are reported in Van311 or surveyed on a walk, never painted over.

Human in the loop: the agent reads Postgres read-only, never publishes an event, never contacts an org outside the app and never sends anything to the City. It only emits JSON payloads to a sink.

## Setup

```
cd agent
pip install -r requirements.txt
```

Python 3.13.

Settings come from the repo-root `env` (or `.env`); real environment variables win. See `env.example`: `POSTGRES_*`, `AGENT_SINK` (`dry-run` default, or `http`), `AGENT_API_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AGENT_AREAS`.

## Commands

```
python -m block_steward suggest | brief | run-once | loop
  [--sink dry-run|http] [--areas "Mount Pleasant,Strathcona"] [--today YYYY-MM-DD]
python -m pytest -q
```

`dry-run` prints a line per payload and writes `agent/out/<kind>-<dedupe_key>.json` (gitignored). `loop` runs suggestions daily at 07:00 and briefings Mondays at 08:00 (Vancouver time), logs errors per run and keeps going.

## Payload contract

Suggestion, `POST {AGENT_API_BASE_URL}/agent/suggestions`. `AGENT_API_BASE_URL` must include `/api` if the app mounts its routes there (for example `https://host/api`):

```json
{"kind":"suggestion","author":"block-steward-agent","local_area":"Mount Pleasant","org_ids":[],"title":"...","body":"...",
 "hotspot":{"h3_r9":"89...","request_type":"...","category":"...","times_reported":9,"months_seen":6,"last_reported":"2026-11-05T..."},
 "event_draft":{"kind":"hotspot","title":"...","category":"...","local_area":"...","latitude":49.26,"longitude":-123.1,"hotspot_id":"<h3_r9>:<request_type>","what_to_bring":"...","signup_url":null},
 "city_program":{"name":"...","url":"..."},
 "dedupe_key":"suggestion:<h3_r9>:<request_type>:<YYYY-Www>"}
```

(`city_program` is `null` when there is none, e.g. graffiti.) Briefing, `POST {AGENT_API_BASE_URL}/agent/briefings` (plan.md section 7 sketches a singular path; the agent uses the plural paths in this README):

```json
{"kind":"briefing","author":"block-steward-agent","local_area":"Mount Pleasant","title":"This week in Mount Pleasant","body":"...","week_of":"2026-11-09","model":"gemini-2.5-flash","dedupe_key":"briefing:<local_area>:<week_of>"}
```

`model` is `"template"` when Gemini was not used. Use `dedupe_key` to ignore repeats. A suggestion's `dedupe_key` is unique per hotspot per ISO week (for example `2026-W45`); a briefing's is unique per area per week.

## For the app and forum team

**Built** in `app/server/api.ts` (migration `007_profiles_and_agent_posts.sql`): suggestions go to `posts` as `pending` rows with `payload` and `dedupe_key`; briefings are `published` and listed at `GET /briefings`. Repeats return 200 with `stored: 0`, so they don't count as failed sends. The Auth0 machine-to-machine app is `block-steward-agent`, authorized for `https://api.blockbyblock` with both scopes; copy its client id and secret into the agent's secrets from the Auth0 dashboard. Showing suggestions to org admins (accept/dismiss) still needs org-admin roles. The original requirements are kept below:

- Verify the Auth0 token (client credentials, audience `https://api.blockbyblock`) and its scope: `suggestions:post` for suggestions, `briefings:post` for briefings.
- **Where suggestions are stored.** The `posts` table (`app/db/migrations/002_app.sql`) has a single `org_id`, no columns for `event_draft`, `hotspot`, `city_program` or `dedupe_key`, and `status` defaults to `'published'`. So:
  - Store one `posts` row per id in `org_ids` (`kind = 'suggestion'`, `author = 'block-steward-agent'`, `local_area`, `org_id`, `title`, `body`), with `status = 'pending'` so it is not shown as a normal post. When `org_ids` is empty, store a single row with `org_id` null.
  - Keep the full payload (`event_draft`, `hotspot`, `city_program`, `org_ids`) in a new `payload jsonb` column, and add a unique `dedupe_key` column (for per-org rows, store `<dedupe_key>:<org_id>`, or make the unique index `(dedupe_key, org_id)`). The app team writes this as a new migration; the agent does not touch the database.
  - Or use a separate table (for example `agent_suggestions`) with those columns. The endpoint builder decides.
- **Empty `org_ids`.** Show the suggestion on the area page for any org admin whose org is in that `local_area`.
- **Skip repeats.** Do not insert a suggestion when a `pending` or `dismissed` suggestion already exists for the same `event_draft.hotspot_id` and org within the last 14 days. (A dismissed hotspot stays uncovered, so without this check it would come back every week.) `dedupe_key` is unique per hotspot per week, so a retry in the same week is also ignored.
- **Briefings** go wherever the forum wants them: `posts` with `kind = 'briefing'` and `status = 'published'`, or `forum_posts` / `forum_replies`. Whoever builds the endpoints decides. Ignore a briefing whose `dedupe_key` already exists.
- `body` is plain text with a blank line (two newline characters) between paragraphs and `- ` list lines. Render it with `white-space: pre-wrap`, never as HTML.
- Suggestions are for org admins of the `org_ids` listed (or of the area, see above): accept opens Create event prefilled from `event_draft`; dismiss hides it and sets `status = 'dismissed'`.
- **Events and coverage.** A hotspot counts as covered by an upcoming event (next 14 days, `done_at` null) when the event's cell matches, or when the event has no cell and no coordinates but has the same `local_area` and `category`. Please set `h3_r9` (and `latitude` / `longitude`) when an event is created, because the Databricks rankings read `events.h3_r9` too.

## Run on a Maritime Agent Box

Install requirements, set the env vars as the box's secrets (`POSTGRES_*`, `AGENT_SINK=http`, `AGENT_API_BASE_URL`, `AUTH0_*`, `GEMINI_API_KEY`), and start `python -m block_steward loop` from `agent/`. The endpoints are live on the API (`POST /agent/suggestions`, `POST /agent/briefings`); use `AGENT_SINK=dry-run` to test without sending.

Run `python -m block_steward run-once` right after deploying. Briefings only run Mondays at 08:00, and a restart after 08:00 on a Monday skips that week.

`loop` retries a failed job (database error or any failed send) after 30 minutes, up to 3 tries, then waits for the next normal slot. A failed send never stops the rest of a run, and `run-once` exits with status 1 if any send failed.

## Known limits

LLM output validation does not yet strip `**`, backticks or bullet characters (it only rejects HTML tags, headings, empty and over-long text). Review the first Gemini briefings when a key is added.
