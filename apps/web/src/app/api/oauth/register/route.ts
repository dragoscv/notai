/**
 * RFC 7591 — OAuth 2.0 Dynamic Client Registration.
 *
 * MCP clients (Claude Desktop, Cursor, Codex, etc.) discover the
 * registration endpoint via the authorization-server metadata and
 * register themselves automatically. We accept anonymous registrations
 * but only grant a conservative default scope set; users can later
 * elevate scopes from the connected-apps screen.
 *
 *   POST /api/oauth/register
 *   {
 *     "redirect_uris": ["https://app.example/callback"],
 *     "client_name": "Example app",
 *     "token_endpoint_auth_method": "none" | "client_secret_post" | "client_secret_basic"
 *   }
 */
import { z } from 'zod';
import { db, oauthClients } from '@notai/db';
import {
    formatScopes,
    generateClientId,
    generateClientSecret,
    hashToken,
    intersectScopes,
    randomToken,
    tokenPrefix,
    DEFAULT_SCOPES,
} from '@notai/lib/oauth';
import { oauthError } from '@/server/oauth-store';

const REGISTRATION_ALLOWED_SCOPES =
    'openid profile email offline_access notes:read notes:write notes:delete folders:read folders:write mcp';

const bodySchema = z.object({
    redirect_uris: z.array(z.string().url()).min(1).max(10),
    client_name: z.string().min(1).max(120).optional(),
    client_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
    scope: z.string().optional(),
    token_endpoint_auth_method: z
        .enum(['none', 'client_secret_basic', 'client_secret_post'])
        .optional()
        .default('client_secret_basic'),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    application_type: z.enum(['web', 'native']).optional(),
});

export async function POST(req: Request) {
    let json: unknown;
    try {
        json = await req.json();
    } catch {
        return oauthError('invalid_request', 'JSON body required.');
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
        return oauthError('invalid_request', parsed.error.issues[0]?.message ?? 'Invalid body.');
    }
    const body = parsed.data;

    // Reject obviously dangerous redirect URIs (loopback http is allowed).
    for (const uri of body.redirect_uris) {
        const u = new URL(uri);
        const isLoopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
        if (u.protocol !== 'https:' && !isLoopback && u.protocol !== 'http:') {
            // allow custom-scheme redirects for native apps, e.g. metu://oauth/callback
        }
        if (u.protocol === 'http:' && !isLoopback) {
            return oauthError(
                'invalid_request',
                'http:// redirect URIs are only allowed for loopback addresses.',
            );
        }
    }

    const isPublic = body.token_endpoint_auth_method === 'none';
    const clientId = generateClientId();
    const secret = isPublic ? null : generateClientSecret();
    const scopes = body.scope
        ? formatScopes(intersectScopes(body.scope, REGISTRATION_ALLOWED_SCOPES))
        : formatScopes(DEFAULT_SCOPES);

    const registrationToken = tokenPrefix('registration') + randomToken(32);

    const [row] = await db
        .insert(oauthClients)
        .values({
            clientId,
            clientSecretHash: secret ? hashToken(secret) : null,
            type: isPublic ? 'public' : 'confidential',
            name: body.client_name ?? 'Untitled OAuth client',
            description: null,
            logoUri: body.logo_uri ?? null,
            clientUri: body.client_uri ?? null,
            redirectUris: body.redirect_uris,
            allowedScopes: scopes || REGISTRATION_ALLOWED_SCOPES,
            dynamicallyRegistered: true,
            registrationAccessTokenHash: hashToken(registrationToken),
        })
        .returning();
    if (!row) return oauthError('server_error', 'Could not register client.', 500);

    const url = new URL(req.url);
    const issuer = `${url.protocol}//${url.host}`;

    return Response.json(
        {
            client_id: clientId,
            client_secret: secret ?? undefined,
            // Per RFC 7591, omit client_secret_expires_at means non-expiring.
            client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
            client_secret_expires_at: 0,
            client_name: row.name,
            redirect_uris: row.redirectUris,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: isPublic ? 'none' : body.token_endpoint_auth_method,
            scope: row.allowedScopes,
            // RFC 7592 management URLs (registration mgmt is read-only for now).
            registration_access_token: registrationToken,
            registration_client_uri: `${issuer}/api/oauth/register/${clientId}`,
        },
        {
            status: 201,
            headers: {
                'cache-control': 'no-store',
                pragma: 'no-cache',
            },
        },
    );
}
