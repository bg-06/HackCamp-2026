# Auth0 backend integration

This branch builds on API PR #26. It changes only backend authentication, tests,
configuration examples and API documentation. It does not implement frontend login
or create/change an Auth0 tenant. No shared database migration is required for auth:
the existing text user IDs store verified Auth0 `sub` values.

## API behavior

- Public GET/HEAD routes remain readable without a token: events, hotspots, issues,
  comments and health. Signed-out responses have no personal RSVP/vote flags and
  count everybody's votes/RSVPs.
- Every write (POST/PUT/PATCH/DELETE) and `/me/*` read requires a resident access token.
- A supplied token is validated even on public routes. Invalid tokens return 401,
  never an anonymous or demo fallback. Missing tokens on protected routes return 401.
- The backend verifies RS256 signatures with keys from the configured tenant's
  `/.well-known/jwks.json`, plus issuer, API audience, expiration, not-before when
  present, a nonempty subject and issued-at. Audience arrays containing the API
  identifier are supported. Signing keys are cached; unknown keys are re-resolved
  under the JWKS resolver's refresh/cooldown rules.
- `X-Demo-User`, body user IDs and unsigned JWT decoding cannot set identity.
  Personal data, daily vote usage, event ownership and comments use verified `sub`.
- Client-credentials / `@clients` machine tokens are accepted only on `/agent/*`, and only with
  the route's scope (`suggestions:post`, `briefings:post`). Everywhere else they get 403, even on
  public reads, and resident tokens get 403 on `/agent/*`. Machines never gain a resident identity.
  Org-admin/moderator roles are not implemented yet.
- No route returns an Auth0 user id. Comments and hosted events show the `profiles` display name
  the frontend saves after sign-in (first name + last initial), or "Neighbour" / "A neighbour".
- Key-service failures return 503 and fail closed. Tokens are not printed or returned
  in errors. 401 responses include a Bearer `WWW-Authenticate` challenge.
- There is no auth-disable/demo-mode setting. Missing or malformed Auth0 configuration
  prevents server startup, rather than leaving writes unprotected.

The implementation follows [Auth0 access-token validation](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)
and uses [jose JWT verification](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md).

## Tenant owner: configure Auth0

If the tenant/API already exists, reuse it and provide its public domain and API
identifier. Otherwise, the person with the Auth0 account completes these steps:

1. In Auth0, create an API named **Block by Block API**, identifier
   `https://api.blockbyblock`, signing algorithm **RS256**. The identifier is an
   audience string; it does not need to be a hosted website.
2. Create a **Single Page Application** for the React frontend. Enable the desired
   user connection (for example Google) and register the exact callback/logout/web
   origin URLs, initially `http://localhost:5173`, plus the real deployed origin.
   Frontend work belongs to the frontend owner; do not use an M2M client for user login.
3. Share the public tenant domain, SPA client ID, and API identifier with the frontend
   owner. Only the tenant issuer and API identifier are needed by this backend.
   Never send a client secret to the browser or paste it into the repository/chat.

The frontend requests an access token for the custom API audience during user login.
An ID token with the SPA client ID as its audience, an opaque userinfo token, or an
Auth0 Management API token will not authenticate to this API. See
[Auth0 token audiences](https://auth0.com/docs/secure/tokens/access-tokens/get-access-tokens).

## Backend configuration and rollout

Put these public settings in the gitignored repo-root `.env`/`env` or deployment
environment (replace the example tenant):

```dotenv
AUTH0_ISSUER=https://your-tenant.us.auth0.com/
AUTH0_AUDIENCE=https://api.blockbyblock
```

The issuer must be an HTTPS origin and must match the domain used by the frontend
to obtain tokens, including a custom domain if one is used. A missing trailing
slash in config is normalized. JWKS URLs come only from this server setting, never
from an untrusted token's issuer/jku header. The backend needs **no client secret**.

Merge/apply API PR #26's database migration before rolling out that API's routes.
Then set Auth0 configuration and restart/deploy the API. Coordinate with the frontend
owner: after this rollout, requests using only the old demo sign-in stop working.
Do not map all existing `demo-user` records to the first real person signing in.
Any deliberate ownership/data transfer requires a separate reviewed migration.

## Frontend owner handoff

Keep browsing public. For signed-in browsing and all writes/personal reads, obtain
the API access token using the Auth0 SDK and send `Authorization: Bearer <token>`.
This includes GET `/me/history`, GET `/me/votes`, votes, RSVPs, comments, event creation
and event completion. A token on GET `/events` or `/issues` supplies personalized flags.
Use the same audience as `AUTH0_AUDIENCE`. Do not send `X-Demo-User`.

On 401, renew the access token or require login. On 403, show permission denied. On
503, preserve the UI state and allow retry. Never put bearer tokens in URLs or logs.

## Frontend sign-in (local testing)

The React app signs in with `@auth0/auth0-react` when `VITE_USE_MOCK=false`. Put the public
SPA values in `frontend/.env` (see `frontend/.env.example`):

```dotenv
VITE_USE_MOCK=false
VITE_AUTH0_DOMAIN=<tenant>.us.auth0.com
VITE_AUTH0_CLIENT_ID=<blockbyblock-web client ID>
VITE_AUTH0_AUDIENCE=https://api.blockbyblock
```

Run the API (`npm --prefix app run api`, port 8000) and the frontend (`npm --prefix frontend run dev`,
port 5173, the URL registered in Auth0). Open Profile → Sign in. After login, every API call carries
`Authorization: Bearer <access token>`; check it in DevTools → Network on any `/api/...` request.
Signed-in reads return your `my_vote`/`going`; votes, RSVPs, comments and new events use your `sub`.

To call the API by hand, copy the token from that request header in your own terminal (never commit
or paste it into chat/issues):

```bash
TOKEN='<paste access token>'
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/me/votes
```

200 = valid resident token, 401 = missing/expired/wrong audience, 403 = machine token (for example the
token on the API's **Test** tab in the Auth0 dashboard). Tokens expire after the API's lifetime setting.

## Verification

`npm --prefix app test` generates RSA keys locally and tests actual signature/claim
verification plus isolated Postgres HTTP behavior. It checks expiry, future claims,
wrong issuer/audience/signature, missing claims, HMAC/unsigned/malformed tokens,
anonymous reads, protected routes, spoofed demo headers, machine tokens, JWKS outages
and remote-key caching. It needs no Auth0 account, secrets or shared-database writes.

Live acceptance still requires the tenant settings and a real user login: browse
signed out; verify protected calls return 401; sign in; vote as one user; verify a
second user has a separate budget/history; and verify only the event's host can
complete it. Existing event-capacity, vote-limit and history tests remain enabled.
