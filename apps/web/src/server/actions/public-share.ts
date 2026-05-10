'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, eq, and, isNull } from '@notai/db';

const enableSchema = z.object({
  noteId: z.string().min(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * Generate (or rotate) a public read-only share token for a note the
 * caller owns. The token is URL-safe base64. Optional expiry; null
 * means the link is valid until manually disabled.
 */
export async function enablePublicShare(
  input: z.input<typeof enableSchema>,
): Promise<{ token: string; expiresAt: Date | null }> {
  const parsed = enableSchema.parse(input);
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;

  const token = randomBytes(18).toString('base64url');
  const expiresAt = parsed.expiresInDays
    ? new Date(Date.now() + parsed.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const updated = await db
    .update(notes)
    .set({
      publicShareToken: token,
      publicShareExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, parsed.noteId), eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    .returning({ id: notes.id });

  if (updated.length === 0) throw new Error('Note not found');
  return { token, expiresAt };
}

/** Remove the public link entirely. */
export async function disablePublicShare(noteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  await db
    .update(notes)
    .set({ publicShareToken: null, publicShareExpiresAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)));
}

/** Read the current public-share status for the owner. */
export async function getPublicShareStatus(noteId: string): Promise<{
  token: string | null;
  expiresAt: Date | null;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [row] = await db
    .select({
      token: notes.publicShareToken,
      expiresAt: notes.publicShareExpiresAt,
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!row) return null;
  return { token: row.token, expiresAt: row.expiresAt };
}

/**
 * Look up a note by its public share token. Returns null if the
 * token is invalid, the link has expired, or the underlying note has
 * been soft-deleted. Caller (the public page) renders the result
 * read-only \u2014 no auth required.
 */
export async function getPublicShare(token: string): Promise<{
  id: string;
  title: string;
  icon: string | null;
  plaintext: string;
  updatedAt: Date;
} | null> {
  if (!token || token.length < 16) return null;
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
      expiresAt: notes.publicShareExpiresAt,
    })
    .from(notes)
    .where(and(eq(notes.publicShareToken, token), isNull(notes.deletedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    plaintext: row.plaintext,
    updatedAt: row.updatedAt,
  };
}
