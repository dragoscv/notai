import { NextResponse } from 'next/server';

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
 *
 * MCP clients fetch this document during the auth bootstrapping
 * sequence (MCP 2025-06-18, §2.3.1). Keep it cacheable and stable.
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
            response_modes_supported: ['query'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_methods_supported: [
                'client_secret_basic',
                'client_secret_post',
                'none',
            ],
            revocation_endpoint_auth_methods_supported: [
                'client_secret_basic',
                'client_secret_post',
                'none',
            ],
            code_challenge_methods_supported: ['S256'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: [],
            service_documentation: `${issuer}/docs/oauth`,
            // RFC 8707 — let clients bind tokens to a specific resource (MCP encourages this).
            authorization_response_iss_parameter_supported: true,
        },
        {
            headers: { 'cache-control': 'public, max-age=300' },
        },
    );
}
