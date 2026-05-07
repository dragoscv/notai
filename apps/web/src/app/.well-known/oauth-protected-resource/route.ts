import { NextResponse } from 'next/server';

/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata.
 *
 * MCP servers MUST publish this so clients can discover the
 * authorization server. The MCP transport returns the URL of this
 * document via the `WWW-Authenticate` header on 401 responses
 * (MCP 2025-06-18 §2.3.1).
 */
export const dynamic = 'force-static';

export function GET(req: Request) {
  const url = new URL(req.url);
  const issuer = `${url.protocol}//${url.host}`;
  return NextResponse.json(
    {
      // The protected resource itself (the MCP endpoint).
      resource: `${issuer}/api/mcp`,
      // The authorization server(s) that mint tokens for it.
      authorization_servers: [issuer],
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
      bearer_methods_supported: ['header'],
      resource_documentation: `${issuer}/docs/oauth`,
      resource_name: 'notai notes',
    },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}
