'use server';

import { revalidatePath } from 'next/cache';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, personalAccessTokens, eq, and, desc } from '@notai/db';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  scope: z.enum(['clipper']).default('clipper'),
});

/** Returns the raw token ONCE — caller must show it to the user immediately. */
export async function createPersonalAccessToken(
  input: z.input<typeof createSchema>,
): Promise<{ id: string; token: string }> {
  const me = await requireUser();
  const { name, scope } = createSchema.parse(input);
  const raw = `notai_pat_${randomBytes(24).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  const [row] = await db
    .insert(personalAccessTokens)
    .values({ userId: me.id, name, scope, tokenHash })
    .returning({ id: personalAccessTokens.id });
  if (!row) throw new Error('Could not create token');
  revalidatePath('/app/settings/integrations');
  return { id: row.id, token: raw };
}

export async function listPersonalAccessTokens() {
  const me = await requireUser();
  return db
    .select({
      id: personalAccessTokens.id,
      name: personalAccessTokens.name,
      scope: personalAccessTokens.scope,
      createdAt: personalAccessTokens.createdAt,
      lastUsedAt: personalAccessTokens.lastUsedAt,
      revokedAt: personalAccessTokens.revokedAt,
    })
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.userId, me.id))
    .orderBy(desc(personalAccessTokens.createdAt));
}

export async function revokePersonalAccessToken(id: string) {
  const me = await requireUser();
  await db
    .update(personalAccessTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(personalAccessTokens.id, id), eq(personalAccessTokens.userId, me.id)));
  revalidatePath('/app/settings/integrations');
}
