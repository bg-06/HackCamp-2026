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

Settings come from the repo-root `env` (or `.env`); real environment variables win. See `env.example`: `POSTGRES_*`, `AGENT_SINK` (`dry-run` default, or `http`), `AGENT_API_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AGENT_AREAS`.

## Commands

```
python -m block_steward suggest | brief | run-once | loop
  [--sink dry-run|http] [--areas "Mount Pleasant,Strathcona"] [--today YYYY-MM-DD]
python -m pytest -q
```

`dry-run` prints a line per payload and writes `agent/out/<kind>-<dedupe_key>.json` (gitignored). `loop` runs suggestions daily at 07:00 and briefings Mondays at 08:00 (Vancouver time), logs errors per run and keeps going.

## Payload contract

Suggestion, `POST {AGENT_API_BASE_URL}/agent/suggestions`:

```json
{"kind":"suggestion","author":"block-steward-agent","local_area":"Mount Pleasant","org_ids":[],"title":"...","body":"...",
 "hotspot":{"h3_r9":"89...","request_type":"...","category":"...","times_reported":9,"months_seen":6,"last_reported":"2026-11-05T..."},
 "event_draft":{"kind":"hotspot","title":"...","category":"...","local_area":"...","latitude":49.26,"longitude":-123.1,"hotspot_id":"<h3_r9>:<request_type>","what_to_bring":"...","signup_url":null},
 "city_program":{"name":"...","url":"..."},
 "dedupe_key":"suggestion:<h3_r9>:<request_type>:<YYYY-MM-DD>"}
```

(`city_program` is `null` when there is none, e.g. graffiti.) Briefing, `POST {AGENT_API_BASE_URL}/agent/briefings`:

```json
{"kind":"briefing","author":"block-steward-agent","local_area":"Mount Pleasant","title":"This week in Mount Pleasant","body":"...","week_of":"2026-11-09","model":"gemini-2.5-flash","dedupe_key":"briefing:<local_area>:<week_of>"}
```

`model` is `"template"` when Gemini was not used. Use `dedupe_key` to ignore repeats.

## For the app and forum team

The two endpoints **do not exist yet**. Please build them (plan.md section 7 has a route sketch):

- Verify the Auth0 token (client credentials, audience `https://api.blockbyblock`) and its scope: `suggestions:post` for suggestions, `briefings:post` for briefings.
- Insert into `posts` (`kind` briefing or suggestion, `author` `block-steward-agent`, `local_area`, `org_id`, `title`, `body`, `status`). The frontend type comments say the forum may use `forum_posts` / `forum_replies` instead; whoever builds the endpoints decides where briefings land.
- `body` is plain text with `\n\n` between paragraphs and `- ` list lines. Render it with `white-space: pre-wrap`, never as HTML.
- Suggestions are for org admins of the `org_ids` listed: accept opens Create event prefilled from `event_draft`; dismiss hides it.

## Run on a Maritime Agent Box

Install requirements, set the env vars as the box's secrets (`POSTGRES_*`, `AGENT_SINK=http`, `AGENT_API_BASE_URL`, `AUTH0_*`, `GEMINI_API_KEY`), and start `python -m block_steward loop` from `agent/`. Until the endpoints exist, leave `AGENT_SINK` at `dry-run`.
