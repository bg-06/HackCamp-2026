import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer, type Server } from 'node:http'
import express from 'express'
import { createRemoteJWKSet, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { createAuthMiddleware, createTokenVerifier, loadAuth0Settings, viewerId, userId } from '../server/auth.js'
import { authFixture, settings } from './auth-fixture.js'

let identity: Awaited<ReturnType<typeof authFixture>>, base: string
const servers: Server[] = []
async function listen(server: Server) {
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  return `http://127.0.0.1:${address.port}`
}
async function appUrl(keys: JWTVerifyGetKey) {
  const app = express()
  app.use(createAuthMiddleware(settings, keys))
  app.get('/events', (req, res) => { res.json({ subject: viewerId(req) }) })
  app.get('/me/history', (req, res) => { res.json({ subject: userId(req) }) })
  app.post('/events', (req, res) => { res.json({ subject: userId(req) }) })
  return listen(createServer(app))
}
before(async () => { identity = await authFixture(); base = await appUrl(identity.keys) })
after(async () => { for (const server of servers) await new Promise<void>(resolve => server.close(() => resolve())) })

async function get(token?: string, path = '/me/history', origin = base) {
  return fetch(origin + path, { headers: token ? { authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10000) })
}

test('configuration requires a trusted HTTPS tenant origin and audience', () => {
  assert.deepEqual(loadAuth0Settings({ AUTH0_ISSUER: 'https://tenant.auth0.com', AUTH0_AUDIENCE: settings.audience }),
    { issuer: 'https://tenant.auth0.com/', audience: settings.audience })
  assert.throws(() => loadAuth0Settings({}), /Configure/)
  for (const issuer of ['http://tenant.auth0.com/', 'https://user:password@tenant.auth0.com/',
    'https://tenant.auth0.com/path', 'https://tenant.auth0.com/?query=true', 'https://tenant.auth0.com/#hash',
    'https://tenant.auth0.com/?', 'https://tenant.auth0.com/#', 'not-a-url'])
    assert.throws(() => loadAuth0Settings({ AUTH0_ISSUER: issuer, AUTH0_AUDIENCE: settings.audience }), /HTTPS/)
})

test('valid resident token supplies the subject and ignores a spoofed demo header', async () => {
  const response = await fetch(base + '/events', { method: 'POST',
    headers: { authorization: `Bearer ${await identity.sign('google-oauth2|alice')}`, 'x-demo-user': 'mallory' } })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).subject, 'google-oauth2|alice')
})

test('public reads stay anonymous and personal reads require a token', async () => {
  const publicRead = await get(undefined, '/events')
  assert.equal(publicRead.status, 200)
  assert.equal((await publicRead.json()).subject, null)
  const personal = await get()
  assert.equal(personal.status, 401)
  assert.match(personal.headers.get('www-authenticate')!, /^Bearer/)
  await personal.arrayBuffer()
})

test('audience arrays containing the API identifier are accepted', async () => {
  const response = await get(await identity.sign('alice', { aud: [settings.issuer + 'userinfo', settings.audience] }))
  assert.equal(response.status, 200)
  await response.arrayBuffer()
})

for (const [name, claims] of [
  ['wrong issuer', { iss: 'https://other-tenant.auth0.com/' }],
  ['ID token audience', { aud: 'spa-client-id' }],
  ['expired', { exp: 1 }],
  ['not yet valid', { nbf: Math.floor(Date.now() / 1000) + 600 }],
  ['missing expiry', { exp: undefined }],
  ['missing subject', { sub: undefined }],
  ['empty subject', { sub: '   ' }],
  ['missing issued-at', { iat: undefined }],
  ['future issued-at', { iat: Math.floor(Date.now() / 1000) + 600 }],
] as [string, JWTPayload][]) test(`rejects ${name} token even on public routes`, async () => {
  const response = await get(await identity.sign('alice', claims), '/events')
  assert.equal(response.status, 401)
  assert.match(response.headers.get('www-authenticate')!, /invalid_token/)
  assert.deepEqual(await response.json(), { error: 'Invalid access token' })
})

test('invalid signatures and unknown keys are rejected', async () => {
  const other = await authFixture()
  let response = await get(await other.sign())
  assert.equal(response.status, 401); await response.arrayBuffer()
  const token = await new SignJWT({ iss: settings.issuer, aud: settings.audience, sub: 'alice',
    exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })
    .setProtectedHeader({ alg: 'RS256', kid: 'unknown' }).sign(identity.privateKey)
  response = await get(token)
  assert.equal(response.status, 401); await response.arrayBuffer()
})

test('HMAC tokens cannot substitute an RSA signature', async () => {
  const token = await new SignJWT({ iss: settings.issuer, aud: settings.audience, sub: 'alice',
    exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })
    .setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32))
  const response = await get(token)
  assert.equal(response.status, 401); await response.arrayBuffer()
})

test('malformed Authorization headers and unsigned tokens are rejected', async () => {
  for (const authorization of ['Basic abc', 'Bearer junk', 'Bearer a.b.', 'Bearer a.b.c,other']) {
    const response = await fetch(base + '/events', { headers: { authorization } })
    assert.equal(response.status, 401)
    await response.arrayBuffer()
  }
})

test('machine tokens cannot use resident identity routes', async () => {
  for (const token of [await identity.sign('app-id@clients'), await identity.sign('alice', { gty: 'client-credentials' })]) {
    const response = await get(token)
    assert.equal(response.status, 403); await response.arrayBuffer()
  }
})

test('JWKS fetch failures fail closed and never fall back to a demo user', async () => {
  const url = await appUrl(async () => { throw new TypeError('Simulated JWKS outage') })
  const response = await get(await identity.sign(), '/me/history', url)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Authentication service unavailable' })
})

test('remote JWKS are fetched once and cached across verified requests', async () => {
  let calls = 0
  const jwksUrl = await listen(createServer((_req, res) => {
    calls++
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ keys: [identity.jwk] }))
  }))
  const verify = createTokenVerifier(settings, createRemoteJWKSet(new URL(jwksUrl)))
  assert.equal(await verify(await identity.sign('alice')), 'alice')
  assert.equal(await verify(await identity.sign('bob')), 'bob')
  assert.equal(calls, 1)
})
