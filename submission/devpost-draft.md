# Block by Block

Draft for team review — November 8, 2026. Verify the final deployed build before submitting. Implementation in the repository is not evidence of a successful live demo.

## Tagline
Turn Vancouver's neighbourhood data into ways to help, one block at a time.

## Inspiration
Seeing a problem in your neighbourhood is easy. Knowing what to do next can be harder. Volunteer opportunities are scattered, recurring issues can disappear into reporting systems, and residents do not always know which problems they can help with themselves.

We built Block by Block around one question: how can local data help someone take a useful next step in their own neighbourhood?

## What it does
Block by Block brings Vancouver volunteer opportunities and neighbourhood issues into a mobile-first web app. It separates two kinds of action: things residents can help with, and issues that require the City.

Residents can browse opportunities, explore recurring hotspots, and start a community event from a hotspot. The app includes sign-ups for in-app events, discussions, votes on City issues, and a personal activity view. Listings from external organizations direct residents to the original signup site.

The Issues flow helps residents prioritize concerns. Its Council action opens an email draft in the resident's own mail app; the app does not automatically contact the City or claim that votes influence municipal decisions.

Our Python Block Steward component generates event suggestions and neighbourhood briefings from the data. Gemini can help word the briefings, with a template fallback. Suggestions are designed for human review rather than automatic event publication. Live delivery and review screens still need to be verified; the agent README currently identifies missing integration endpoints.

## How we built it
The frontend uses React, TypeScript and Vite, with MapLibre for map views. An Express API reads and writes PostgreSQL data. Auth0 integration provides user sign-in and backend access-token verification.

The data work uses Vancouver open data, Databricks processing and H3 geographic cells to organize recurring local reports. App-facing datasets are published to PostgreSQL. A separate Python agent reads those datasets to draft suggestions and briefings.

## Challenges we ran into
One challenge was keeping the frontend, API and data pipeline aligned while different teammates worked on them at the same time. Another was preserving the difference between a volunteer opportunity and an issue that only the City should address. Deployment and authentication also required shared decisions about URLs, API audiences and configuration.

Team review: keep these statements only if they accurately describe our experience; add one concrete example from each teammate.

## Accomplishments that we're proud of
We connected the idea of neighbourhood awareness to specific next actions: find an opportunity, join an event, start one where help is needed, or raise a City issue. The repository also brings together a web interface, authenticated API, geographic data processing and an agent component around a common data model.

## What we learned
Useful community software needs more than a map of problems. It needs clear ownership, trustworthy data, and an action that makes sense for the person looking at it. We also learned how much integration depends on small agreements: route names, identifiers, timestamps and what a successful demo actually means.

Team review: replace or personalize this section with what we actually learned during the event.

## What's next
Finish and validate organization-admin and moderator workflows, connect the agent's delivery and review paths, and test the experience with residents and community organizations. We also want to make data freshness and source attribution clearer, and evaluate event outcomes without claiming that a change in reports proves an event caused it.

## Built with
React, TypeScript, Vite, Express, PostgreSQL, Auth0, Python, Databricks, H3, MapLibre, Google Gemini (optional briefing wording).

Add Vercel or Maritime only after the team confirms the corresponding deployment. Do not claim a sponsor integration solely because a configuration or deployment guide exists.

## Submission links
- Repository: https://github.com/bg-06/HackCamp-2026
- Working public demo: PENDING — deployment owner
- Video: PENDING — recording owner
- Figma: include only if used

## Before publishing
- Confirm project name, team names, technologies and award categories.
- Verify every demonstrated action against the final build.
- Remove internal review notes and all PENDING fields.
- Identify sample data and prerecorded component demonstrations clearly.
- Do not claim verified impact, City endorsement, completed role authorization, or a live agent workflow without evidence.
