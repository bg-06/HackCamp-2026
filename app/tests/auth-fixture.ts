import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'

export const settings = { issuer: 'https://test-tenant.auth0.com/', audience: 'https://api.blockbyblock' }

export async function authFixture() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
  const keys = createLocalJWKSet({ keys: [jwk] })
  return { settings, keys, jwk, privateKey,
    sign: (subject = 'alice', claims: JWTPayload = {}) => new SignJWT({
      iss: settings.issuer, aud: settings.audience, sub: subject,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims,
    }).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).sign(privateKey),
  }
}
