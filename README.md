# Block by Block

Turn Vancouver's neighbourhood data into ways to help, one block at a time.

Built at **HackCamp 2026** (nwPlus, UBC Vancouver).

**Live demo:** https://hack-camp-2026-mpue.vercel.app

## What it does

Seeing a problem in your neighbourhood is easy. Knowing what to do about it is harder. Block by Block uses the City of Vancouver's 311 data to split local issues by who can actually fix them:

- **Volunteer (Track 1): neighbours can help.** Recurring litter, small abandoned items and street debris become cleanup opportunities; graffiti becomes a walk to survey and report it, never a paint-out. Spots that keep getting reported and have nothing planned show up under **Needs help**, and anyone can start an event from one. The feed also lists City programs and local organisations' events; those link out to the original sign-up page.
- **Issues (Track 2): only the City can fix it.** Potholes, streetlights and damaged sidewalks. Residents prioritise up to two open issues at a time and can send the top five to Council as an email draft from their own mail app. We don't send anything to the City or claim votes change City decisions.
- **Profile.** Your sign-ups, your votes, your volunteer hours, and a CSV download of those hours.
- **Community updates.** The Block Steward agent drafts weekly "ways to help this week" briefings per neighbourhood and suggests events for uncovered hotspots. A person always reviews a suggestion; the agent never publishes an event on its own.

The app is mobile-first and installable as a PWA.

## How it works

```
Vancouver Open Data (311, volunteer sources)
        │
        ▼
Databricks: ingest → bronze/silver/gold pipeline → H3 hotspots, rankings, summaries
        │  publish gold tables
        ▼
PostgreSQL ◄──── Express API (Railway) ◄──── React frontend (Vercel)
        ▲                 ▲
        │ read-only       │ M2M token
        └──── Block Steward agent (Python + Gemini)
```

- **Data:** the 311 history is grouped into H3 resolution-9 cells to find recurring hotspots. A daily Databricks job refreshes the pipeline, and a 15-minute job refreshes rankings and event impact and republishes the app-facing gold tables to Postgres.
- **API:** Express 5 + TypeScript on Railway. Auth0 access tokens are verified on the server; the agent uses a scoped machine-to-machine token.
- **Frontend:** React 19, TypeScript and Vite, with MapLibre maps (OpenFreeMap tiles), deployed on Vercel. `/api/*` is proxied to the Railway API.
- **Agent:** Python 3.13. It reads Postgres read-only, and Gemini words the briefings when a key is set (otherwise a template does).

## Repository layout

| Path | What's there |
|---|---|
| [`frontend/`](frontend/README.md) | React app: pages, components, API client |
| `app/` | Express API, Postgres migrations, ingest and seed scripts |
| [`databricks/`](databricks/README.md) | Bundle, notebooks, pipeline, SQL, dashboard and Genie space |
| [`agent/`](agent/README.md) | Block Steward agent (suggestions and briefings) |
| `data/` | 311 sample, seed volunteer listings |
| `docs/` | Integration notes: API, Auth0, ingest, volunteer sources |
| `openapi.yaml` | API contract |
| `plan.md` | Full project plan and product decisions |

## Run it locally

You need Node.js 22+, a PostgreSQL database, and (for the agent) Python 3.13.

1. Copy `env.example` to `.env` at the repo root and fill in the Postgres and Auth0 values.
2. Set up the database and start the API (port 8000):

   ```bash
   cd app
   npm install
   npm run db:migrate
   npm run ingest:volunteer-events
   npm run api
   ```

3. In another terminal, start the frontend (http://localhost:5173):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   For UI work without a backend, use `npm run dev:mock`, which serves sample data.

4. Optional: run the agent without sending anything.

   ```bash
   cd agent
   pip install -r requirements.txt
   python -m block_steward run-once --sink dry-run
   ```

The Databricks side deploys as a bundle from `databricks/`; see [databricks/README.md](databricks/README.md).

## Tests

```bash
npm --prefix app test
(cd agent && python -m pytest -q)
python -m pytest -q databricks/tests
```

## Built with

React, TypeScript, Vite, MapLibre, Express, PostgreSQL, Auth0, Databricks, H3, Python, Google Gemini, Vercel, Railway.

## Data

City data comes from the [City of Vancouver Open Data Portal](https://opendata.vancouver.ca/) under the Open Government Licence – Vancouver. Block by Block is a student project and is not affiliated with or endorsed by the City of Vancouver.
