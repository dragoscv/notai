'use server';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, apiKeys, eq, and, isNull } from '@notai/db';
import { revalidatePath } from 'next/cache';

const KEY_PREFIX = 'nk_'; // "Notai Key"
const SCOPES_DEFAULT = 'notes:read notes:write';

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export async function listMyApiKeys(): Promise<ApiKeyRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)));
  return rows;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.string().trim().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function createApiKey(
  input: z.input<typeof createSchema>,
): Promise<{ id: string; key: string; prefix: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { name, scopes, expiresInDays } = createSchema.parse(input);
  const id = randomBytes(8).toString('hex');
  const secret = randomBytes(28).toString('base64url');
  const fullKey = `${KEY_PREFIX}${secret}`;
  const prefix = fullKey.slice(0, 11); // "nk_" + 8 chars
  const hashed = createHash('sha256').update(fullKey).digest('hex');
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  await db.insert(apiKeys).values({
    id,
    userId: session.user.id,
    name,
    prefix,
    hashedKey: hashed,
    scopes: scopes && scopes.length > 0 ? scopes : SCOPES_DEFAULT,
    expiresAt,
  });
  revalidatePath('/app/settings/api-keys');
  return { id, key: fullKey, prefix };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, session.user.id)));
  revalidatePath('/app/settings/api-keys');
}

/**
 * Verify an `Authorization: Bearer <key>` header. Returns the
 * associated user id and scopes, or null if the key is missing,
 * revoked, expired, or invalid. Updates `lastUsedAt` on success
 * (best-effort, fire-and-forget).
 */
export async function verifyApiKey(
  rawHeader: string | null | undefined,
): Promise<{ userId: string; scopes: string[] } | null> {
  if (!rawHeader) return null;
  const m = rawHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const key = m[1]!.trim();
  if (!key.startsWith(KEY_PREFIX)) return null;
  const hashed = createHash('sha256').update(key).digest('hex');
  const [row] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.hashedKey, hashed))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  // Fire-and-forget update.
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => undefined);
  return { userId: row.userId, scopes: row.scopes.split(/\s+/).filter(Boolean) };
}
