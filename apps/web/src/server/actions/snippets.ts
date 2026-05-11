'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, userSnippets, eq, and, notInArray } from '@notai/db';

const snippetSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .transform((s) =>
      s
        .trim()
        .replace(/^::/, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, ''),
    )
    .refine((s) => s.length > 0, 'Name required'),
  body: z.string().min(1).max(4000),
});

const saveSchema = z.object({
  snippets: z.array(snippetSchema).max(500),
});

async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user.id;
}

export interface UserSnippet {
  name: string;
  body: string;
}

export async function listMySnippets(): Promise<UserSnippet[]> {
  const userId = await requireUser();
  const rows = await db
    .select({ name: userSnippets.name, body: userSnippets.body })
    .from(userSnippets)
    .where(eq(userSnippets.userId, userId));
  return rows;
}

/**
 * Bulk replace: any snippet name in `snippets` is upserted; any prior
 * snippet of the user not in the new list is deleted.
 */
export async function saveMySnippets(
  input: z.input<typeof saveSchema>,
): Promise<{ ok: true; count: number }> {
  const userId = await requireUser();
  const { snippets } = saveSchema.parse(input);

  const byName = new Map<string, string>();
  for (const s of snippets) byName.set(s.name, s.body);
  const cleaned = Array.from(byName, ([name, body]) => ({ name, body }));

  if (cleaned.length === 0) {
    await db.delete(userSnippets).where(eq(userSnippets.userId, userId));
    return { ok: true, count: 0 };
  }

  const keepNames = cleaned.map((s) => s.name);
  await db
    .delete(userSnippets)
    .where(and(eq(userSnippets.userId, userId), notInArray(userSnippets.name, keepNames)));

  const now = new Date();
  for (const s of cleaned) {
    await db
      .insert(userSnippets)
      .values({ userId, name: s.name, body: s.body, updatedAt: now })
      .onConflictDoUpdate({
        target: [userSnippets.userId, userSnippets.name],
        set: { body: s.body, updatedAt: now },
      });
  }
  return { ok: true, count: cleaned.length };
}
