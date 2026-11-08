# Demo video script

Target: approximately 3 minutes 30 seconds, leaving space below the event's published 4-minute maximum. Rehearse once; timing includes clicks and pauses. This is a recording plan, not a claim that the deployment has passed verification.

## Before recording
- Use the final public URL. Verify the page in a signed-out browser.
- Pick one known volunteer event and one City issue with readable data.
- Prepare two resident accounts with separate identities and fresh vote budgets.
- Verify sign-in, RSVP, comments, voting and profile data on the actual build.
- Record only actions that work. If a scene is unavailable, omit it or label a separate component preview explicitly.
- Hide passwords, tokens, dashboard secrets and unrelated personal information.
- Keep sample data visibly labeled. Avoid lengthy live sign-in by preparing a session, but show where login begins.

## 0:00–0:25 — The problem
Screen: opening title, then the Volunteer feed.

“When you notice a problem in your neighbourhood, what happens next? You might want to help, but finding the right opportunity can take more effort than the action itself. Block by Block helps Vancouver residents move from noticing a problem to taking a useful next step.”

## 0:25–1:05 — Find a way to help
Screen: browse the feed, choose a neighbourhood or sort option, open a verified event.

“We separate things neighbours can help with from issues that need the City. The Volunteer feed brings opportunities together with their location, organizer and signup details. External listings take you to the original signup page. Community events can support signups directly in the app.”

Action: demonstrate one successful RSVP on an in-app event, if verified. Show its updated state. Do not imply an external signup happened inside the app.

## 1:05–1:40 — Turn a hotspot into an event
Screen: Needs help → a verified hotspot → Start one → prefilled event form.

“Recurring reports can show where help may be needed. Instead of stopping at a pin on a map, a resident can start an event from a hotspot. The form carries over relevant details, so the next step is organizing people rather than copying information.”

Action: show the prefilled form. Submit only if creation is verified and the team has approved a clearly labeled demo event; otherwise stop at the form and say so.

## 1:40–2:15 — Issues that need the City
Screen: Issues → issue details → vote → Council email action if verified.

“Some work belongs to the City. This separate feed lets residents discuss and prioritize those concerns, with a limited daily voting budget. The Council action prepares an email in the resident's own mail app. It does not automatically send a message, and we do not claim that a vote changes the City's priorities.”

Action: show the changed vote count or budget. Preview an email draft without sending it.

## 2:15–2:45 — Data and architecture
Screen: a prepared architecture slide or verified Databricks dashboard.

“Underneath the interface, we use Vancouver open data, Databricks processing and H3 geographic cells to organize local patterns. PostgreSQL serves the application data through an Express API. React powers the interface, and Auth0 handles user sign-in with token verification on the backend.”

If showing a dashboard, confirm its queries work before recording. Do not imply a live refresh happened during the clip.

## 2:45–3:10 — Agent component, optional
Screen: verified agent dry-run output, clearly labeled “Component preview — not live in-app delivery,” unless the full integration has since passed testing.

“Our Block Steward component drafts event suggestions and weekly neighbourhood briefings. Gemini can help with wording, and a template works without it. The goal is to support organizers, with people keeping control over what gets published.”

If delivery remains incomplete, add: “The generation component is implemented; connecting its output to the in-app review workflow is our next integration step.”

## 3:10–3:30 — Close
Screen: return to the app, then project name and public URL.

“Block by Block connects local information with local action. Our next steps are finishing organization and moderation workflows, validating the full deployment, and testing with community groups. We want helping your neighbourhood to start with one clear next step.”

Update the closing status after integration. Do not describe deployment as unfinished if it has passed verification by recording time.
