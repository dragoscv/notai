import { NextResponse } from 'next/server';
import { getPublicJwks } from '@/server/oidc-keys';

/**
 * JWKS endpoint (RFC 7517 + OIDC Discovery 1.0 §10).
 *
 * Publishes the public half of the ES256 key used to sign id_tokens.
 * Advertised by /.well-known/oauth-authorization-server and
 * /.well-known/openid-configuration as `jwks_uri`. Cache for a few
 * minutes — JWT verifiers fetch this on a slow cadence and we don't
 * expect frequent key rotation. When OIDC_SIGNING_KEY_JWK is unset the
 * route returns `{ keys: [] }` (id_tokens are then not issued).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const jwks = await getPublicJwks();
  return NextResponse.json(jwks, {
    headers: {
      'cache-control': 'public, max-age=300, must-revalidate',
      'content-type': 'application/jwk-set+json',
    },
  });
}
