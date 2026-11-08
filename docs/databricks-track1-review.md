# Track 1 review and event-impact integration

Reviewed November 7, 2026 (Vancouver), using current `bbb.gold` tables. This replaces
the older partial-load Track 1 count in `docs/databricks-run-notes.md`.

## Current Track 1 labels

The effective track (`coalesce(track_overrides.track, type_categories.ai_track)`)
contains six request types. All six currently come from frozen AI labels, with no
override on these specific rows. Other manual overrides still exclude bulky dumping,
feces, external/private-property graffiti and inquiries.

| Request type | Cases in current enriched data | Opened in last 12 months | Review |
|---|---:|---:|---|
| Abandoned Non-Recyclables-Small Case | 43,753 | 8,658 | Retain for small-item/litter cleanup opportunities |
| Abandoned Recyclables Case | 18,079 | 4,073 | Retain for small-item/litter cleanup opportunities |
| Graffiti Removal - City Property Case | 11,565 | 2,780 | Retain only as a reporting/survey opportunity; no automatic paint-out |
| Street Cleaning and Debris Pick Up Case | 10,365 | 2,313 | Broad label: offer litter pickup, leave City service work to City crews |
| Graffiti Removal - Park Property Case | 1,293 | 270 | Retain only as a reporting/survey opportunity; no automatic paint-out |
| Loose Litter Clean Up Case | 937 | 182 | Retain for litter cleanup opportunities |

Counts include closed and open cases, use deduplicated current cases, and are a
snapshot rather than fixed expected values. No live label changes were made.

The City supports volunteer litter cleanups through its
[Neighbourhood Cleanup programs](https://vancouver.ca/people-programs/neighbourhood-cleanup-programs.aspx)
and [Cleanup Party](https://vancouver.ca/people-programs/neighbourhood-cleanup-party.aspx).
Its [street-cleaning guidance](https://vancouver.ca/streets-transportation/street-and-sidewalk-cleaning-and-maintenance.aspx)
distinguishes volunteering from requesting street/debris service. Its
[graffiti guidance](https://vancouver.ca/home-property-development/manage-graffiti.aspx)
provides reporting routes for public-property graffiti. The review above interprets
those programs for our app; a Track 1 label is an opportunity to help, not permission
to perform every operation named in the underlying 311 service request.

### App copy mismatch to resolve with the frontend owner

`agent/block_steward/programs.py` already avoids promising a cleanup program for
graffiti, and the agent suggests reporting/surveying it. In contrast,
`frontend/src/pages/NewEventPage.tsx` currently defaults graffiti events to a
"Graffiti paint-out" title and shows cleanup-supplies copy for every category.
The frontend should offer a graffiti reporting/survey walk, or require a separately
approved removal program, before this path is shown in the demo. This review does not
change the frontend or alter the gold track contract.

## Next integration artifact

The repository now has:

- A native 15-minute schedule on the existing `bbb_refresh_rankings` job. The app
  saves completed events and votes in Postgres and Databricks refreshes them without
  n8n, a webhook secret, or a Databricks token in the app.
- `databricks/operations/verify_event_impact.py`: SELECT-only verifier. It checks the
  fast job and both tasks succeeded, recomputes expected impact counts, compares the
  event inputs and counts in Delta/Postgres, and verifies publication freshness.

Live readiness check: **no completed app events**. The verifier correctly reports
WAITING. The actual parameterized verification query is also checked read-only
against an existing incomplete event, which must fail completion verification.

## Remaining owners and acceptance check

1. App owner: implement host-authorized `POST /events/:id/done`, commit `done_at`,
   `category`, and valid resolution-9 `h3_r9` to Postgres.
   The current API has no event-completion endpoint and still uses temporary demo identity.
2. Databricks owner: confirm both native schedules remain enabled after deployments.
3. Together: complete a controlled event through the app, wait for the next successful
   scheduled refresh (or run the fast job manually for the demo), and run:

   `python databricks/operations/verify_event_impact.py --event-id <id>`

Acceptance is a successful authorized completion, a subsequent successful fast-job run,
and a fresh published impact row whose inputs and counts match recomputation.
Zero reports can pass; missing rows or stale publications cannot. This check verifies
data flow, not that an event caused a long-term reduction in reports.
