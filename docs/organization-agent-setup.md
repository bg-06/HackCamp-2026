# Organization suggestions and moderator setup

This branch builds on PR #38. Merge that PR first. No production Auth0 or database settings are changed by this code.

Organization admins are identified by an Auth0-verified resident subject and an approved `org_members` row with role `admin`. Auth0 is the identity provider; membership is organization-specific and is controlled by the API. A moderator is a resident whose verified Auth0 access token has `moderate:organizations` in its `permissions` array. Configure that API permission in Auth0, enable RBAC and inclusion of permissions in access tokens, and assign it only to trusted moderators. Machine credentials cannot use these routes.

After verifying an organization's representative out of band, a moderator can grant or revoke membership with `PUT /moderation/organizations/{orgId}/members/{url-encoded-auth0-sub}` and JSON `{ "approved": true }` or `{ "approved": false }`. This endpoint is not a public self-approval flow. Membership is checked on every relevant request; revocation takes effect immediately. There is no moderation UI or claim-submission workflow yet.

Signed-in approved admins can view suggestions for their organizations on Community updates, dismiss them, or choose Plan event. The suggestion stays pending until the event is published, at which point the API checks membership again and atomically creates the organization event and marks the suggestion accepted. Suggestions without an organization are not exposed here; they require a future area-wide assignment policy. Briefings are public and can be filtered by neighbourhood on the same page.

The UI only offers a draft when its hotspot still exists in the current feed. If a pipeline refresh removes the hotspot, the draft cannot be published; it remains pending until dismissed or otherwise resolved. Auth0 configuration, initial moderator assignment and production deployment must be coordinated with the owners.
