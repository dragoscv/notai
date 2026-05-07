/**
 * UserInfo endpoint (OIDC Core 1.0 §5.3).
 * Bearer access token with `openid` scope required.
 */
import { db, eq, users } from '@notai/db';
import { parseScopes } from '@notai/lib/oauth';
import { findActiveTokenByHash, oauthError } from '@/server/oauth-store';

export async function GET(req: Request) {
    return handle(req);
}

export async function POST(req: Request) {
    return handle(req);
}

async function handle(req: Request) {
    const authz = req.headers.get('authorization') ?? '';
    if (!authz.toLowerCase().startsWith('bearer ')) {
        return oauthError('invalid_request', 'Bearer token required.', 401);
    }
    const raw = authz.slice(7).trim();
    const tok = await findActiveTokenByHash(raw, 'access_token');
    if (!tok || !tok.userId) {
        return oauthError('invalid_token', 'Invalid or expired token.', 401);
    }
    const scopes = parseScopes(tok.scopes);
    if (!scopes.includes('openid')) {
        return oauthError('insufficient_scope', 'openid scope required.', 403);
    }

    const [u] = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(users)
        .where(eq(users.id, tok.userId))
        .limit(1);
    if (!u) return oauthError('invalid_token', 'User not found.', 401);

    const claims: Record<string, unknown> = { sub: u.id };
    if (scopes.includes('profile')) {
        claims.name = u.name;
        claims.picture = u.image;
        claims.preferred_username = u.email;
    }
    if (scopes.includes('email')) {
        claims.email = u.email;
        claims.email_verified = !!u.email;
    }

    return Response.json(claims, { headers: { 'cache-control': 'no-store' } });
}
