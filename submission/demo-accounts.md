# Demo account preparation

Status: preparation checklist only. No accounts have been created or seeded by this document. No credentials belong in this repository.

## Current implementation

As reviewed on November 8, 2026, `docs/auth0-backend.md` documents Auth0 resident authentication and explicitly excludes organization-admin/moderator role implementation. `app/server/auth.ts` validates access tokens and uses their verified subject as identity; it does not implement a three-role permission model.

`org_members` exists in `app/db/migrations/002_app.sql`, but a table or an Auth0 role assignment alone does not enforce API authorization. Confirm the final branch before treating these findings as current.

## Account matrix

| Demo persona | Account alias, not an email | Required setup | Readiness |
| --- | --- | --- | --- |
| Resident | bbb-demo-resident | Real login through the configured Auth0 SPA; verified API token | Code present; live login and actions unverified |
| Organization admin | bbb-demo-org-admin | Separate Auth0 user; approved organization membership plus implemented server authorization | Blocked on role integration |
| Moderator | bbb-demo-moderator | Separate Auth0 user; implemented and enforced moderation permission | Blocked on role integration |
| Second resident for isolation checks | bbb-demo-resident-2 | Different Auth0 subject from the first resident | To create and verify |

Do not present differently named resident accounts as working admin/moderator roles.

## Handoff to the Auth0 owner

1. Confirm the tenant, SPA client ID, API audience, allowed connection and exact deployed callback/logout/origin URLs with the frontend owner.
2. Create or register separate test users using a connection enabled for that SPA. Use team-controlled test email addresses where needed; no real residents' accounts.
3. Keep passwords in a private team credential channel or password manager. Do not add passwords, bearer tokens, client secrets or recovery codes to GitHub, Devpost or a recording.
4. Sign in through the real frontend and verify that each account has its own Auth0 subject and application state. Do not use client-credentials tokens as resident logins; the API accepts them only on `/agent/*`.
5. Coordinate the role/permission contract with the backend owner before assigning organization or moderator privileges. Confirm the server enforces those permissions.

## Demo data to prepare

- One clearly labeled community demo event with available capacity and a future start time.
- A verified location and category; link to an existing hotspot only if it is a real matching fixture.
- One short neutral comment, for example: “Demo: where should volunteers meet?”
- A resident RSVP and one available vote action, without exhausting the daily budget during rehearsal.
- A separate organization fixture only once the admin workflow exists.
- A harmless moderation fixture only once its endpoint and UI exist.

Prefer existing application workflows for fixture creation. Coordinate any seed or cleanup operation with the database owner; do not clear shared tables or rewrite real ownership. A SQL row in `org_members` does not create an Auth0 login.

## Acceptance checks

- [ ] Signed-out visitors can browse public data.
- [ ] Signed-out protected writes and personal reads return 401.
- [ ] Resident login reaches the deployed app successfully.
- [ ] Resident can RSVP, comment and vote; changes remain after refresh.
- [ ] Resident 2 has a separate vote budget, signups and history.
- [ ] Comments and resident-hosted events show a display name (first name plus last initial), never an Auth0 id.
- [ ] Only an event host can complete that event.
- [ ] A resident cannot invoke admin or moderation actions, once implemented.
- [ ] Organization admin actions are restricted to the authorized organization, once implemented.
- [ ] Moderator can perform the agreed moderation action, once implemented.
- [ ] Logout clears access to personal actions in the UI.

## Private handoff record

Keep actual addresses and credentials outside this repository. Track only readiness here:

| Item | Owner | Status |
| --- | --- | --- |
| Production URL | Deployment teammate | Pending |
| Resident test users | Auth0 owner | Pending |
| Organization authorization | Backend/Auth0 owners | Pending |
| Moderator authorization | Backend/Auth0 owners | Pending |
| Event and comment fixtures | App/data owner | Pending |
| Full demo rehearsal | Submission owner | Pending |

If roles are unfinished at submission time, record the resident flow and list admin/moderator workflows as future work. Do not disable authentication to make a recording pass.
