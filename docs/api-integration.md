# API integration: hotspots, events, history, and upvotes

This API branch is independent of the native Databricks schedule PR. It includes
the full filename-tracked migration runner so all app migrations can be applied.
It does not merge or deploy the Databricks PR.

## Bring-up

Install the app lockfile dependencies with `npm --prefix app ci`, then obtain approval
before running `npm --prefix app run db:migrate` against the shared team database.
The new `006_vote_budget.sql` adds immutable vote casts and per-user/day usage rows,
and backfills allowance from existing upvote timestamps. Removing votes never refunds
usage. No existing votes are deleted; legacy downvotes remain stored but are ignored
by the API and the updated Databricks priority SQL.

Restart/deploy the API after migrations. `npm --prefix app run api` starts it locally.
The branch does not change the frontend, seed times, or create sample events in the
shared database. The Databricks score SQL change also needs its normal deployment
before Genie priority scores adopt the new formula.

## Frontend contract

- **GET `/hotspots`** returns `HelpHotspot[]` with `id = h3_r9|request_type`, cell-centre
  `lat`/`lng`, category, local area, repeat counts, and an ISO timestamp for last report.
  Optional `area` and integer `limit` (1–5000) filter/cap the list.
- **POST `/events`** accepts the existing frontend `NewEvent` shape and returns 201
  with a `VolunteerEvent`. With `hotspotId`, the server looks up and copies the gold
  hotspot's cell/category/area, ignoring conflicting client metadata. The legacy
  colon hotspot ID is accepted but stored/returned as a pipe ID. Without a hotspot,
  provide category, localArea, and Vancouver lat/lng. Title/location are required,
  times must include timezone offsets and be future/ordered, and capacity is 1–100.
  The server selects the host from caller identity, creates the event and host RSVP
  atomically, and sets `sample: false`. No client organiser/host override is accepted.
- **POST `/events/:id/done`** accepts optional `peopleCount`, `bagsCollected`, and
  HTTPS `afterPhotoUrl`. Only the current API host identity can complete an in-app
  event after it starts. Completion uses server time and repeats retain original
  completion/counts. It returns the event including `doneAt`. The scheduled Databricks
  refresh can then calculate impact from its stored H3/category/completion time.
- **GET `/me/history`** returns the existing `VolunteerRecord[]` shape for the caller's
  RSVPs on completed events. Hours estimate event duration, capped at completion time,
  and never include future/incomplete events. These are RSVP-based estimates, not
  verified attendance or certified volunteer hours. Completed RSVPs cannot be added
  or removed via the regular RSVP endpoints; historical participation is retained.
- **GET `/me/votes`** returns the daily budget below. Use it to render votes left today.
- **PUT `/issues/:id/vote`**, body `{ "value": 1 }`, returns 200 with the budget plus
  `myVote: 1`. Other values, including -1, return 400. A repeated active upvote does
  not spend allowance or change its timestamp.
- **DELETE `/issues/:id/vote`** returns 200 with the budget plus `myVote: 0`. It never
  refunds allowance. Recasting after removal spends another vote.
- The third new cast in the same Vancouver calendar day returns **429** with
  `code: "DAILY_VOTE_LIMIT"`, `error`, and budget fields. Parse that JSON to show the
  limit message. A database row lock serializes same-user casts/removals across API
  workers. The current vote's `created_at` and immutable `vote_casts.cast_at` record
  its time. Daily usage survives vote removal, closed issues, and API restarts.

Budget example:

```json
{
  "dailyLimit": 2,
  "votesUsed": 1,
  "votesRemaining": 1,
  "voteDate": "2026-11-08",
  "resetsAt": "2026-11-09T07:00:00.000Z"
}
```

The day and next reset use `America/Vancouver`, not the client device timezone.
The shared Postgres timezone was checked read-only and returned UTC-07:00 for the
current Vancouver dates.

Issue responses keep `up_votes` excluding the caller and `my_vote` as 0/1 to preserve
the existing frontend convention. `down_votes` is always 0. New `score` includes
**all** upvotes: `base_score + 3 * total_up_votes`. Lists sort by that score. The
frontend can use returned `score`, or compute `base_score + 3 * (up_votes + my_vote)`.
Event `commentCount` and issue `comment_count` are returned without multiplying votes.

## Authenticated identity

The Auth0 backend branch removes demo identity. Send a verified Auth0 **access token**
for this API in `Authorization: Bearer <token>`. All writes and `/me/*` reads require
it; anonymous browsing remains public. `X-Demo-User` is ignored. Quotas, event ownership,
RSVPs, comments and history use the validated `sub`. See `docs/auth0-backend.md` for
tenant setup, backend configuration, and the frontend owner's token handoff.

No existing demo rows are automatically reassigned to a real user. Profile hours
remain RSVP-based estimates; authentication does not verify physical attendance.

## Validation

`npm --prefix app test` compiles and runs HTTP integration tests against an isolated
in-memory Postgres instance using the real schema migrations and postgres.js driver.
It reads no team credentials and writes no shared data. Tests use locally generated
RSA keys and signed JWTs. Tests cover event creation,
host RSVP, completion/history, validation, parallel capacity/vote requests, idempotent
votes, no refunds, migration backfill/replay, legacy downvotes and score ordering.

The embedded database multiplexes connections over one underlying Postgres instance;
the parallel tests cover overlapping HTTP requests and transactional behavior, but
are not a substitute for a multi-process production PostgreSQL load test.

Full response schemas are in `openapi.yaml`.
