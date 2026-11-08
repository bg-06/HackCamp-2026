# API integration: hotspots, events, history, and upvotes

This API branch is independent of the native Databricks schedule PR. It includes
the full filename-tracked migration runner so all app migrations can be applied.
It does not merge or deploy the Databricks PR.

## Bring-up

Install the app lockfile dependencies with `npm --prefix app ci`, then obtain approval
before running `npm --prefix app run db:migrate` against the shared team database.
`006_vote_budget.sql` introduced historical cast and daily-usage records. The newer
`009_active_vote_limit.sql` changes the active-vote model: for accounts with more
than two active votes on open issues, it removes all but the two most recently cast.
Review how many accounts and votes this affects before applying it to a shared
database. Historical cast records and legacy downvotes remain stored; downvotes are
ignored by the API and the updated Databricks priority SQL.

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
- **GET `/me/votes`** returns the active-vote budget below. Use it to render available slots.
- **PUT `/issues/:id/vote`**, body `{ "value": 1 }`, returns 200 with the budget plus
  `myVote: 1`. Other values, including -1, return 400. A repeated active upvote does
  not consume another slot or change its timestamp.
- **DELETE `/issues/:id/vote`** returns 200 with the budget plus `myVote: 0` and frees a slot.
- A third active vote returns **429** with `code: "VOTE_LIMIT"`, `error`, and budget fields.
  **POST `/issues/:id/vote/swap`**, body `{ "removeIssueId": "...", "expectedIssueIds": ["...", "..."] }`,
  atomically replaces an existing vote with the issue in the URL. It returns **409** if
  the active votes changed since the comparison. A per-user row lock serializes vote
  changes across API workers. Votes for issues absent from the open feed do not consume a slot.

Budget example:

```json
{
  "limit": 2,
  "votesUsed": 1,
  "votesRemaining": 1
}
```

There is no daily reset. See `frontend/README.md` for the comparison and discovery UI requirements.

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
