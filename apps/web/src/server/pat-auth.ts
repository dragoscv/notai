import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { db, personalAccessTokens, users, eq, and, isNull } from '@notai/db';

export const PAT_SCOPES = [
  'clipper',
  'notes:read',
  'notes:write',
  'search:read',
  'ai:read',
] as const;
export type PatScope = (typeof PAT_SCOPES)[number];

export interface PatPrincipal {
  userId: string;
  email: string | null;
  tokenId: string;
  scopes: PatScope[];
}

function parseScopes(raw: string | null | undefined): PatScope[] {
  if (!raw) return ['clipper'];
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((s): s is PatScope => (PAT_SCOPES as readonly string[]).includes(s));
}

/**
 * Validate a PAT from the `Authorization: Bearer …` header. Constant-time
 * compare via the hashed lookup; we mark the token used asynchronously so
 * we don't slow down the hot path.
 */
export async function authenticatePat(req: Request): Promise<PatPrincipal | NextResponse> {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }
  const raw = auth.slice(7).trim();
  if (raw.length < 16) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  const [row] = await db
    .select({
      tokenId: personalAccessTokens.id,
      userId: personalAccessTokens.userId,
      email: users.email,
      scope: personalAccessTokens.scope,
    })
    .from(personalAccessTokens)
    .innerJoin(users, eq(users.id, personalAccessTokens.userId))
    .where(
      and(eq(personalAccessTokens.tokenHash, tokenHash), isNull(personalAccessTokens.revokedAt)),
    )
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 });
  }
  // Best-effort touch — failures don't matter, the request is already auth'd.
  void db
    .update(personalAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(personalAccessTokens.id, row.tokenId))
    .catch(() => undefined);
  return {
    userId: row.userId,
    email: row.email,
    tokenId: row.tokenId,
    scopes: parseScopes(row.scope),
  };
}

/** Return 403 if the principal lacks the required scope. */
export function requireScope(principal: PatPrincipal, scope: PatScope): NextResponse | null {
  if (principal.scopes.includes(scope)) return null;
  return NextResponse.json(
    { error: 'Insufficient scope', required: scope, granted: principal.scopes },
    { status: 403 },
  );
}
