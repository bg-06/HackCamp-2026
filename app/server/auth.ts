import type { Request, RequestHandler, Response } from 'express'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { ApiError } from './validation.js'

export interface Auth0Settings { issuer: string; audience: string }
const subjects = new WeakMap<Request, string>()

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

export function createTokenVerifier(settings: Auth0Settings, keys?: JWTVerifyGetKey) {
  const config = loadAuth0Settings({ AUTH0_ISSUER: settings.issuer, AUTH0_AUDIENCE: settings.audience })
  // The key URL is derived only from trusted server configuration, never jku/iss in a token.
  const resolveKey = keys ?? createRemoteJWKSet(new URL('.well-known/jwks.json', config.issuer), {
    timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000,
  })
  return async (token: string) => {
    const { payload } = await jwtVerify(token, resolveKey, {
      issuer: config.issuer, audience: config.audience, algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5,
    })
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) throw new ApiError(401, 'Invalid access token')
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > Date.now() / 1000 + 5)
      throw new ApiError(401, 'Invalid access token')
    // Resident writes must not turn an agent's client-credentials token into a person.
    if (payload.gty === 'client-credentials' || payload.sub.endsWith('@clients'))
      throw new ApiError(403, 'A resident access token is required')
    return payload.sub
  }
}

const invalidTokenCodes = new Set([
  'ERR_JWT_EXPIRED', 'ERR_JWT_CLAIM_VALIDATION_FAILED', 'ERR_JWT_INVALID',
  'ERR_JWS_INVALID', 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED', 'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWKS_NO_MATCHING_KEY',
])

function unauthorized(res: Response, message: string, invalid = false) {
  res.set('WWW-Authenticate', `Bearer realm="block-by-block"${invalid ? ', error="invalid_token"' : ''}`)
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
      subjects.set(req, await verify(match[1]!))
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
