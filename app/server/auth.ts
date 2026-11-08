import type { Request, RequestHandler, Response } from 'express'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { ApiError } from './validation.js'

export interface Auth0Settings { issuer: string; audience: string }

// A verified caller: a resident (Auth0 user) or a machine (client-credentials app such as the agent).
export type Principal =
  | { kind: 'resident'; sub: string; permissions: ReadonlySet<string> }
  | { kind: 'machine'; sub: string; scopes: ReadonlySet<string> }

const subjects = new WeakMap<Request, string>()
const machines = new WeakMap<Request, Extract<Principal, { kind: 'machine' }>>()
const permissions = new WeakMap<Request, ReadonlySet<string>>()

// Machine tokens are accepted only on these paths; resident tokens are refused there.
const MACHINE_PATH = /^\/agent(?:\/|$)/

export function loadAuth0Settings(env: NodeJS.ProcessEnv = process.env): Auth0Settings {
  const issuer = env.AUTH0_ISSUER?.trim(), audience = env.AUTH0_AUDIENCE?.trim()
  if (!issuer || !audience) throw new Error('Configure AUTH0_ISSUER and AUTH0_AUDIENCE before starting the API')
  let url: URL
  try { url = new URL(issuer) } catch { throw new Error('AUTH0_ISSUER must be an HTTPS tenant origin') }
  if (url.protocol !== 'https:' || url.href !== `${url.origin}/`)
    throw new Error('AUTH0_ISSUER must be an HTTPS tenant origin, without a path, query or credentials')
  return { issuer: url.href, audience }
}

export function viewerId(req: Request): string | null { return subjects.get(req) ?? null }

export function userId(req: Request): string {
  const subject = viewerId(req)
  if (!subject) throw new ApiError(401, 'Sign in required')
  return subject
}

export function requirePermission(req: Request, permission: string): void {
  userId(req)
  if (!permissions.get(req)?.has(permission)) throw new ApiError(403, `Missing permission ${permission}`)
}

/** The calling machine's client id, after checking its token carries `scope`. */
export function requireScope(req: Request, scope: string): string {
  const machine = machines.get(req)
  if (!machine) throw new ApiError(401, 'Machine access token required')
  if (!machine.scopes.has(scope)) throw new ApiError(403, `Missing scope ${scope}`)
  return machine.sub
}

export function createTokenVerifier(settings: Auth0Settings, keys?: JWTVerifyGetKey) {
  const config = loadAuth0Settings({ AUTH0_ISSUER: settings.issuer, AUTH0_AUDIENCE: settings.audience })
  // The key URL is derived only from trusted server configuration, never jku/iss in a token.
  const resolveKey = keys ?? createRemoteJWKSet(new URL('.well-known/jwks.json', config.issuer), {
    timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000,
  })
  return async (token: string): Promise<Principal> => {
    const { payload } = await jwtVerify(token, resolveKey, {
      issuer: config.issuer, audience: config.audience, algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5,
    })
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) throw new ApiError(401, 'Invalid access token')
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > Date.now() / 1000 + 5)
      throw new ApiError(401, 'Invalid access token')
    // A client-credentials token is a machine, never a person, so it can't act as a resident.
    if (payload.gty === 'client-credentials' || payload.sub.endsWith('@clients')) {
      const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : []
      return { kind: 'machine', sub: payload.sub, scopes: new Set(scopes) }
    }
    const granted = Array.isArray(payload.permissions) ? payload.permissions.filter((p): p is string => typeof p === 'string') : []
    return { kind: 'resident', sub: payload.sub, permissions: new Set(granted) }
  }
}

const invalidTokenCodes = new Set([
  'ERR_JWT_EXPIRED', 'ERR_JWT_CLAIM_VALIDATION_FAILED', 'ERR_JWT_INVALID',
  'ERR_JWS_INVALID', 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED', 'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWKS_NO_MATCHING_KEY',
])

function unauthorized(res: Response, message: string, invalid = false) {
  res.set('WWW-Authenticate', `Bearer realm="greenhands-bc"${invalid ? ', error="invalid_token"' : ''}`)
  res.status(401).json({ error: message })
}

export function createAuthMiddleware(settings: Auth0Settings, keys?: JWTVerifyGetKey): RequestHandler {
  const verify = createTokenVerifier(settings, keys)
  return async (req, res, next) => {
    const authorization = req.get('authorization')
    const needsUser = req.method !== 'OPTIONS' && (!['GET', 'HEAD'].includes(req.method) || /^\/me(?:\/|$)/.test(req.path))
    if (authorization === undefined) {
      if (needsUser) return unauthorized(res, 'Sign in required')
      return next()
    }
    const headerCount = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i]!.toLowerCase() === 'authorization').length
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization)
    if (headerCount !== 1 || !match || authorization.length > 16384)
      return unauthorized(res, 'Invalid access token', true)
    try {
      const principal = await verify(match[1]!)
      const machinePath = MACHINE_PATH.test(req.path)
      if (principal.kind === 'machine') {
        if (!machinePath) return void res.status(403).json({ error: 'A resident access token is required' })
        machines.set(req, principal)
      } else {
        if (machinePath) return void res.status(403).json({ error: 'A machine access token is required' })
        subjects.set(req, principal.sub)
        permissions.set(req, principal.permissions)
      }
      next()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return unauthorized(res, 'Invalid access token', true)
        return void res.status(err.status).json({ error: err.message })
      }
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      if (invalidTokenCodes.has(code)) return unauthorized(res, 'Invalid access token', true)
      // A JWKS outage is not a reason to accept unverified claims or use demo identity.
      res.status(503).json({ error: 'Authentication service unavailable' })
    }
  }
}
