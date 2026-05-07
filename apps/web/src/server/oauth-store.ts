/**
 * DB-aware OAuth helpers — bridges pure crypto helpers in
 * `@notai/lib/oauth` with the persistence layer.
 *
 * Tokens never round-trip through the DB in raw form; we store
 * sha256 hashes only. Lookups are by hash.
 */
import 'server-only';
import { and, db, eq, gt, isNull, oauthClients, oauthTokens, oauthConsents, type OauthClient, type OauthToken } from '@notai/db';
import {
    expiresIn,
    hashToken,
    randomToken,
    tokenPrefix,
    type OAuthErrorCode,
} from '@notai/lib/oauth';

export type TokenKind = 'authorization_code' | 'access_token' | 'refresh_token';

export interface IssueTokenInput {
    clientId: string;
    userId?: string | null;
    kind: TokenKind;
    scopes: readonly string[];
    ttlSeconds: number;
    codeChallenge?: string | null;
    codeChallengeMethod?: string | null;
    redirectUri?: string | null;
    metadata?: Record<string, unknown>;
    /** Pass to keep refresh-rotation lineage. New family if omitted. */
    familyId?: string | null;
}

export interface IssuedToken {
    token: string;
    id: string;
    expiresAt: Date;
    familyId: string;
}

export async function issueToken(input: IssueTokenInput): Promise<IssuedToken> {
    const raw =
        tokenPrefix(
            input.kind === 'authorization_code'
                ? 'authorization_code'
                : input.kind === 'access_token'
                  ? 'access_token'
                  : 'refresh_token',
        ) + randomToken(32);
    const tokenHash = hashToken(raw);
    const expires = expiresIn(input.ttlSeconds);
    const familyId = input.familyId ?? crypto.randomUUID();

    const [row] = await db
        .insert(oauthTokens)
        .values({
            clientId: input.clientId,
            userId: input.userId ?? null,
            kind: input.kind,
            tokenHash,
            tokenFamilyId: familyId,
            scopes: input.scopes.join(' '),
            codeChallenge: input.codeChallenge ?? null,
            codeChallengeMethod: input.codeChallengeMethod ?? null,
            redirectUri: input.redirectUri ?? null,
            metadata: input.metadata ?? {},
            expiresAt: expires,
        })
        .returning();
    if (!row) throw new Error('Failed to insert oauth token');
    return { token: raw, id: row.id, expiresAt: expires, familyId };
}

export async function findActiveTokenByHash(
    raw: string,
    kind: TokenKind,
): Promise<OauthToken | null> {
    const [row] = await db
        .select()
        .from(oauthTokens)
        .where(
            and(
                eq(oauthTokens.tokenHash, hashToken(raw)),
                eq(oauthTokens.kind, kind),
                isNull(oauthTokens.consumedAt),
                isNull(oauthTokens.revokedAt),
                gt(oauthTokens.expiresAt, new Date()),
            ),
        )
        .limit(1);
    return row ?? null;
}

export async function findTokenByHashAnyState(
    raw: string,
    kind: TokenKind,
): Promise<OauthToken | null> {
    const [row] = await db
        .select()
        .from(oauthTokens)
        .where(and(eq(oauthTokens.tokenHash, hashToken(raw)), eq(oauthTokens.kind, kind)))
        .limit(1);
    return row ?? null;
}

export async function consumeToken(id: string): Promise<void> {
    await db
        .update(oauthTokens)
        .set({ consumedAt: new Date() })
        .where(eq(oauthTokens.id, id));
}

/** Revoke an entire refresh-token family (RFC 6749 §10.4 replay defence). */
export async function revokeTokenFamily(familyId: string): Promise<void> {
    await db
        .update(oauthTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(oauthTokens.tokenFamilyId, familyId), isNull(oauthTokens.revokedAt)));
}

export async function revokeTokensForClientAndUser(
    clientId: string,
    userId: string,
): Promise<void> {
    await db
        .update(oauthTokens)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(oauthTokens.clientId, clientId),
                eq(oauthTokens.userId, userId),
                isNull(oauthTokens.revokedAt),
            ),
        );
}

export async function findActiveClientByClientId(
    clientId: string,
): Promise<OauthClient | null> {
    const [row] = await db
        .select()
        .from(oauthClients)
        .where(and(eq(oauthClients.clientId, clientId), isNull(oauthClients.revokedAt)))
        .limit(1);
    return row ?? null;
}

export async function findClientByInternalId(id: string): Promise<OauthClient | null> {
    const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
    return row ?? null;
}

// ─── Consent ─────────────────────────────────────────────────────────────

export async function upsertConsent(
    userId: string,
    clientId: string,
    scopes: readonly string[],
): Promise<void> {
    const scopeStr = scopes.join(' ');
    const [existing] = await db
        .select()
        .from(oauthConsents)
        .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.clientId, clientId)))
        .limit(1);
    if (existing) {
        await db
            .update(oauthConsents)
            .set({ scopes: scopeStr, revokedAt: null, version: existing.version + 1 })
            .where(eq(oauthConsents.id, existing.id));
    } else {
        await db.insert(oauthConsents).values({ userId, clientId, scopes: scopeStr });
    }
}

export async function findConsent(userId: string, clientId: string) {
    const [row] = await db
        .select()
        .from(oauthConsents)
        .where(
            and(
                eq(oauthConsents.userId, userId),
                eq(oauthConsents.clientId, clientId),
                isNull(oauthConsents.revokedAt),
            ),
        )
        .limit(1);
    return row ?? null;
}

// ─── Standardised error responses ────────────────────────────────────────

export function oauthError(
    error: OAuthErrorCode,
    description?: string,
    status: 400 | 401 | 403 | 500 = 400,
): Response {
    return new Response(JSON.stringify({ error, error_description: description }), {
        status,
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            pragma: 'no-cache',
        },
    });
}

/**
 * Bearer-token auth check used by every protected resource (MCP, REST APIs).
 * Returns the active token row + linked user id, or an error response.
 */
export async function requireBearer(req: Request, requiredScope?: string) {
    const authz = req.headers.get('authorization') ?? '';
    if (!authz.toLowerCase().startsWith('bearer ')) {
        return {
            ok: false as const,
            response: bearerChallenge(req, 'invalid_request', 'Bearer token required.'),
        };
    }
    const raw = authz.slice(7).trim();
    const tok = await findActiveTokenByHash(raw, 'access_token');
    if (!tok || !tok.userId) {
        return {
            ok: false as const,
            response: bearerChallenge(req, 'invalid_token', 'Token expired or unknown.'),
        };
    }
    if (requiredScope) {
        const scopes = new Set(tok.scopes.split(/\s+/).filter(Boolean));
        if (!scopes.has(requiredScope) && !scopes.has('mcp')) {
            return {
                ok: false as const,
                response: bearerChallenge(
                    req,
                    'insufficient_scope',
                    `Requires scope "${requiredScope}".`,
                    requiredScope,
                ),
            };
        }
    }
    return { ok: true as const, token: tok, userId: tok.userId };
}

/**
 * 401 / 403 with `WWW-Authenticate: Bearer` header that points clients to
 * the resource-metadata document (MCP requirement, RFC 9728 §5.1).
 */
function bearerChallenge(
    req: Request,
    error: 'invalid_request' | 'invalid_token' | 'insufficient_scope',
    description: string,
    scope?: string,
): Response {
    const status = error === 'insufficient_scope' ? 403 : 401;
    const url = new URL(req.url);
    const resourceMetadata = `${url.protocol}//${url.host}/.well-known/oauth-protected-resource`;
    const parts = [
        `Bearer realm="notai"`,
        `error="${error}"`,
        `error_description="${description.replace(/"/g, '\\"')}"`,
        `resource_metadata="${resourceMetadata}"`,
    ];
    if (scope) parts.push(`scope="${scope}"`);
    return new Response(JSON.stringify({ error, error_description: description }), {
        status,
        headers: {
            'content-type': 'application/json',
            'www-authenticate': parts.join(', '),
            'cache-control': 'no-store',
        },
    });
}
