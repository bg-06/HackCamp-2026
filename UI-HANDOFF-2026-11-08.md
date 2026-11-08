# UI work handoff — November 8, 2026

## Where the work is

- Worktree: `C:\Users\rosha\.codex\worktrees\ui-feedback-plan\HackCamp-2026`
- Branch: `codex/ui-feedback-original`. Commit `ab98df4` contains the original baseline UI work; the subsequent UI, integration, and handoff changes are committed on this branch.
- Local live-data preview: `http://127.0.0.1:5178/`; community updates: `http://127.0.0.1:5178/community-updates`. The local Vite and API processes must remain running; the API uses this worktree's ignored root `.env`.
- This branch has not been pushed or opened as a PR. Reconcile it with current `origin/main` before merging; other chats have worked independently.

## Current behavior

- Original-based UI with suggestion header and horizontal Needs help cards. Entire cards link to the appropriate event/report flow. Undated event tiles omit the Ongoing badge. Issue fallback images vary by category and issue details label them illustrative.
- The map displays by default; attribution starts collapsed, and Directions is a button on the address row.
- Settings offers system/light/dark theme and Original/New profile comparison. After the vote set `PROFILE_COMPARISON_ENABLED` and `DEFAULT_PROFILE_DESIGN` in `frontend/src/lib/profileDesign.ts`.
- Voting supports two active votes and a comparison dialog to atomically swap one. The full-quota status is quiet, and Issues introduction is shorter. Shared-database UI testing used a temporary identity: two votes, two comparison choices, a swap and persistence after reload passed. The two test votes and their usage record were removed and cleanup was verified. Normal live preview has no frontend Auth0 settings, so real account sign-in has not been verified.
- Community updates are available from either profile and at `/community-updates`. Public briefings and the neighbourhood filter use the real API. Signed-in suggestion list, dismiss, and Plan event preserve organization authorization. `suggestionId` stays in the form payload; the API accepts it within the event transaction. The event form retains report-only handling for dumped items and graffiti-walk handling.
- The matching organization API changes are integrated in this worktree, including authorization and tests; the event completion endpoint still only accepts hotspot events, so organization event completion is not verified or claimed to work.
- PWA manifest, icons and a production service worker are present. The worker serves a basic offline page for failed navigation and does not cache API or account responses. Actual install prompt/standalone behavior still needs testing in target browsers over HTTPS.

## Verification and remaining work

- Frontend `npm run build` (including TypeScript) passed after the UI changes; `npm run lint` exits successfully with two `react(set-state-in-effect)` warnings in `AgentPage.tsx` relating to clearing loading states.
- App `npm test`: 54 tests passed, including movable-vote swap, unauthorized organization access, suggestion dismissal and accepting a suggestion on event creation. This uses isolated PGlite and test Auth0 keys.
- Public `/community-updates` navigation and real API empty state were checked in the browser. The database returned no briefings at the time; non-empty neighbourhood filtering and signed-in admin suggestion-to-publish flow were not tested end to end in the UI because frontend Auth0 is not configured. Test with a real approved admin and representative pending suggestion, including failed publish retaining pending status, dismiss, and prefilled fields. Do not use mock results as evidence of the live workflow.
- The original deployed API and this worktree must be aligned with the movable-vote contract. `app/db/migrations/009_active_vote_limit.sql` was not applied to the shared database. It removes older active votes for users with more than two; review impact and coordinate before deployment.
- Reviewed the separate voting chat: PR #41 (`codex/issue-priorities-pr`) contains movable voting and local discovery. The location-data chat is preparing Databricks volunteer snapshot changes; its listings and photos live in Postgres. Reconcile those branches and avoid overwriting their changes when preparing the final PR.
- A comprehensive accessibility audit, screen-reader review, actual PWA installation test, authenticated production voting, and organization-event completion remain outstanding. The main checked text/button colors meet 4.5:1; this is not a claim of full WCAG conformance.
- Vite reports the map bundle is larger than 500 kB. An ignored `.pnpm-store/` directory may appear untracked from dependency setup; do not include it in a commit.
