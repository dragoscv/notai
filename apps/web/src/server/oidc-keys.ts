import 'server-only';
import { importJWK, exportJWK, type JWK, type KeyLike, SignJWT } from 'jose';

/**
 * OIDC id_token signing key management.
 *
 * Notai issues asymmetric ES256 (P-256) id_tokens signed with a key
 * loaded from the `OIDC_SIGNING_KEY_JWK` env var. The matching public
 * key is published at /api/oauth/jwks. Clients verify id_tokens by
 * fetching that JWKS document and looking up the `kid` from the JWT
 * header.
 *
 * Env shape (single ES256 private JWK serialised to JSON):
 *
 *   OIDC_SIGNING_KEY_JWK='{
 *     "kty":"EC","crv":"P-256","alg":"ES256",
 *     "x":"...","y":"...","d":"...",
 *     "kid":"2026-05-01"
 *   }'
 *
 * Rotate keys by writing the new JWK and deploying. There's no
 * multi-key overlap implemented today — that's a follow-up when a
 * real-world client breaks on rotation. JWKS still validates as long
 * as ONE active key is present.
 *
 * If the env var is missing, id_tokens are not issued (the token
 * endpoint silently degrades to opaque access-tokens only) and JWKS
 * serves `{ keys: [] }`. This lets the OAuth provider keep working
 * for non-OIDC scopes (notes:read, mcp, ...) without a key configured.
 */

interface ActiveKey {
  jwk: JWK;
  privateKey: KeyLike;
  kid: string;
  alg: 'ES256';
}

let cached: ActiveKey | null | undefined;

async function loadKey(): Promise<ActiveKey | null> {
  if (cached !== undefined) return cached;
  const raw = process.env.OIDC_SIGNING_KEY_JWK;
  if (!raw) {
    cached = null;
    return null;
  }
  let parsed: JWK;
  try {
    parsed = JSON.parse(raw) as JWK;
  } catch {
    console.warn('OIDC_SIGNING_KEY_JWK is not valid JSON; id_token signing disabled');
    cached = null;
    return null;
  }
  if (parsed.kty !== 'EC' || parsed.crv !== 'P-256' || !parsed.d) {
    console.warn(
      'OIDC_SIGNING_KEY_JWK must be an ES256 private JWK (kty=EC, crv=P-256, d=...); id_token signing disabled',
    );
    cached = null;
    return null;
  }
  try {
    const key = (await importJWK(parsed, 'ES256')) as KeyLike;
    cached = {
      jwk: parsed,
      privateKey: key,
      kid: parsed.kid ?? 'default',
      alg: 'ES256',
    };
    return cached;
  } catch (err) {
    console.warn('Failed to import OIDC_SIGNING_KEY_JWK:', err);
    cached = null;
    return null;
  }
}

/**
 * Returns the public JWKS document. Always returns 200 with a
 * (possibly empty) `keys` array; clients tolerate empty JWKS by
 * falling back to non-OIDC flows.
 */
export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const active = await loadKey();
  if (!active) return { keys: [] };
  // Strip the private parameter `d` before publishing.
  const pub = (await exportJWK(active.privateKey)) as JWK;
  return {
    keys: [
      {
        ...pub,
        kid: active.kid,
        alg: active.alg,
        use: 'sig',
      },
    ],
  };
}

export async function hasSigningKey(): Promise<boolean> {
  const k = await loadKey();
  return Boolean(k);
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Sign an OIDC id_token. Returns null when no signing key is
 * configured — callers should then omit `id_token` from the token
 * response.
 */
export async function signIdToken(
  claims: IdTokenClaims,
  ttlSeconds = 3600,
): Promise<string | null> {
  const active = await loadKey();
  if (!active) return null;
  const { iss, sub, aud, ...rest } = claims;
  return await new SignJWT(rest)
    .setProtectedHeader({ alg: 'ES256', kid: active.kid, typ: 'JWT' })
    .setIssuer(iss)
    .setSubject(sub)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(active.privateKey);
}
