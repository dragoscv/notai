'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, eq, and, or, isNull } from '@notai/db';
import { hashNotePassword, verifyNotePassword } from '@/lib/note-password';
import { dispatchNoteEvent } from '@/server/actions/webhooks';

const SHARE_PW_COOKIE = (noteId: string) => `notai_share_pw_${noteId}`;

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
  try {
    await dispatchNoteEvent(userId, 'note.published', {
      noteId: parsed.noteId,
      slug: token,
      publishedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch note.published failed',
      err instanceof Error ? err.message : err,
    );
  }
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
  try {
    await dispatchNoteEvent(userId, 'note.unpublished', {
      noteId,
      unpublishedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch note.unpublished failed',
      err instanceof Error ? err.message : err,
    );
  }
}

/** Read the current public-share status for the owner. */
export async function getPublicShareStatus(noteId: string): Promise<{
  token: string | null;
  expiresAt: Date | null;
  hasPassword: boolean;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [row] = await db
    .select({
      token: notes.publicShareToken,
      expiresAt: notes.publicShareExpiresAt,
      passwordHash: notes.passwordHash,
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!row) return null;
  return { token: row.token, expiresAt: row.expiresAt, hasPassword: Boolean(row.passwordHash) };
}

/** Set or rotate the password gate. Use `setNotePassword` from note-password.ts instead — kept as a thin alias for share-side callers. */
export async function setPublicSharePassword(input: {
  noteId: string;
  password: string;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const trimmed = input.password.trim();
  if (trimmed.length < 4) throw new Error('Password must be at least 4 characters');
  if (trimmed.length > 200) throw new Error('Password is too long');
  const hash = hashNotePassword(trimmed);
  const updated = await db
    .update(notes)
    .set({ passwordHash: hash, passwordSetAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.id, input.noteId), eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    .returning({ id: notes.id });
  if (updated.length === 0) throw new Error('Note not found');
}

/** Remove the password gate (link still works without a password). */
export async function clearPublicSharePassword(noteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  await db
    .update(notes)
    .set({ passwordHash: null, passwordSetAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)));
}

/** Look up a note by either its random token or its custom slug. */
export async function getPublicShare(token: string): Promise<{
  id: string;
  title: string;
  icon: string | null;
  plaintext: string;
  updatedAt: Date;
} | null> {
  if (!token || token.length < 3) return null;
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
      expiresAt: notes.publicShareExpiresAt,
      passwordHash: notes.passwordHash,
    })
    .from(notes)
    .where(
      and(
        or(eq(notes.publicShareToken, token), eq(notes.publicShareSlug, token)),
        isNull(notes.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  if (row.passwordHash) {
    const jar = await cookies();
    const cookieVal = jar.get(SHARE_PW_COOKIE(row.id))?.value;
    if (cookieVal !== row.passwordHash) return null;
  }
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    plaintext: row.plaintext,
    updatedAt: row.updatedAt,
  };
}

/**
 * Three-way gate used by the /p/[token] page so it can render a
 * password prompt instead of a 404 when the link is real but locked.
 */
export async function getPublicShareGate(token: string): Promise<
  | { kind: 'notFound' }
  | { kind: 'locked'; token: string }
  | {
      kind: 'ok';
      note: {
        id: string;
        title: string;
        icon: string | null;
        plaintext: string;
        updatedAt: Date;
      };
    }
> {
  if (!token || token.length < 3) return { kind: 'notFound' };
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
      expiresAt: notes.publicShareExpiresAt,
      passwordHash: notes.passwordHash,
    })
    .from(notes)
    .where(
      and(
        or(eq(notes.publicShareToken, token), eq(notes.publicShareSlug, token)),
        isNull(notes.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return { kind: 'notFound' };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return { kind: 'notFound' };
  if (row.passwordHash) {
    const jar = await cookies();
    const cookieVal = jar.get(SHARE_PW_COOKIE(row.id))?.value;
    if (cookieVal !== row.passwordHash) return { kind: 'locked', token };
  }
  return {
    kind: 'ok',
    note: {
      id: row.id,
      title: row.title,
      icon: row.icon,
      plaintext: row.plaintext,
      updatedAt: row.updatedAt,
    },
  };
}

/**
 * Form action used by the unlock prompt. Sets an httpOnly cookie
 * scoped to the share path on success so subsequent loads bypass the
 * gate for ~7 days.
 */
export async function unlockPublicShare(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!token || !password) return { ok: false, error: 'Missing fields' };
  const [row] = await db
    .select({
      id: notes.id,
      passwordHash: notes.passwordHash,
      expiresAt: notes.publicShareExpiresAt,
    })
    .from(notes)
    .where(
      and(
        or(eq(notes.publicShareToken, token), eq(notes.publicShareSlug, token)),
        isNull(notes.deletedAt),
      ),
    )
    .limit(1);
  if (!row || !row.passwordHash) return { ok: false, error: 'Not found' };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'This link has expired' };
  }
  const ok = verifyNotePassword(row.passwordHash, password);
  if (!ok) return { ok: false, error: 'Wrong password' };
  const jar = await cookies();
  jar.set(SHARE_PW_COOKIE(row.id), row.passwordHash, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: `/p/${encodeURIComponent(token)}`,
    maxAge: 7 * 24 * 60 * 60,
  });
  return { ok: true };
}

/**
 * Set or clear a custom slug for the share link. Slugs are URL-safe
 * (lowercase letters, digits, hyphens) and must be 3\u201360 chars. Pass an
 * empty string to clear. Throws on collision with another note from
 * the same owner.
 */
const slugSchema = z
  .string()
  .trim()
  .max(60)
  .regex(/^$|^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i, 'Use letters, digits, and hyphens')
  .transform((s) => s.toLowerCase());

export async function setPublicShareSlug(input: {
  noteId: string;
  slug: string;
}): Promise<{ slug: string | null }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const slug = slugSchema.parse(input.slug);
  const newValue = slug.length === 0 ? null : slug;

  // The unique partial index (owner_id, public_share_slug) handles
  // collision \u2014 we surface a friendly error on conflict.
  try {
    const updated = await db
      .update(notes)
      .set({ publicShareSlug: newValue, updatedAt: new Date() })
      .where(and(eq(notes.id, input.noteId), eq(notes.ownerId, userId), isNull(notes.deletedAt)))
      .returning({ id: notes.id });
    if (updated.length === 0) throw new Error('Note not found');
    return { slug: newValue };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('notes_owner_share_slug_unq')) {
      throw new Error('You already use that slug for another note');
    }
    throw e;
  }
}
