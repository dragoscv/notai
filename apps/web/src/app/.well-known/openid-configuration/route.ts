import { NextResponse } from 'next/server';

/**
 * OpenID Connect Discovery 1.0. MCP and OIDC clients sometimes look
 * here first — keep parity with /.well-known/oauth-authorization-server.
 */
export const dynamic = 'force-static';

export function GET(req: Request) {
  const url = new URL(req.url);
  const issuer = `${url.protocol}//${url.host}`;
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
      revocation_endpoint: `${issuer}/api/oauth/revoke`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      scopes_supported: [
        'openid',
        'profile',
        'email',
        'offline_access',
        'notes:read',
        'notes:write',
        'notes:delete',
        'folders:read',
        'folders:write',
        'mcp',
      ],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['ES256'],
    },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}
