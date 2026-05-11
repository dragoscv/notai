'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, eq, and, isNull } from '@notai/db';
import { revalidatePath } from 'next/cache';
import { hashNotePassword, verifyNotePassword } from '@/lib/note-password';

/**
 * Per-note password lock. Hash format and the `notai-unlock-<id>`
 * session cookie are documented in `@/lib/note-password`. The same
 * format is used by the public share gate so a single password
 * unlocks both flows.
 */

const COOKIE_TTL_SECONDS = 60 * 60 * 4; // 4 hours

const setSchema = z.object({
  noteId: z.string().min(1),
  password: z.string().min(4).max(200),
});

/** Owner sets (or rotates) the lock password. */
export async function setNotePassword(input: z.input<typeof setSchema>) {
  const { noteId, password } = setSchema.parse(input);
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const updated = await db
    .update(notes)
    .set({
      passwordHash: hashNotePassword(password),
      passwordSetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, session.user.id), isNull(notes.deletedAt)))
    .returning({ id: notes.id });
  if (updated.length === 0) throw new Error('Note not found');
  revalidatePath(`/app/n/${noteId}`);
}

/** Owner clears the lock. */
export async function clearNotePassword(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .update(notes)
    .set({ passwordHash: null, passwordSetAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, session.user.id)));
  revalidatePath(`/app/n/${noteId}`);
}

/** Returns true if a password is currently set on this note. */
export async function isNoteLocked(noteId: string): Promise<boolean> {
  const [row] = await db
    .select({ hash: notes.passwordHash })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  return Boolean(row?.hash);
}

/**
 * Verify the password and, on success, set a session cookie that
 * unlocks this note for the next few hours. Returns `{ ok: false }`
 * on bad password (caller shows an inline error \u2014 we never throw).
 */
export async function unlockNote(input: {
  noteId: string;
  password: string;
}): Promise<{ ok: boolean }> {
  const [row] = await db
    .select({ hash: notes.passwordHash })
    .from(notes)
    .where(eq(notes.id, input.noteId))
    .limit(1);
  if (!row?.hash) return { ok: true }; // not locked \u2014 treat as success
  if (!verifyNotePassword(row.hash, input.password)) return { ok: false };
  const cookieStore = await cookies();
  cookieStore.set(`notai-unlock-${input.noteId}`, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_TTL_SECONDS,
  });
  return { ok: true };
}

/** Server-side helper for layouts/pages: is this note unlocked for the current session? */
export async function isNoteUnlockedForSession(noteId: string): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(`notai-unlock-${noteId}`)?.value === '1';
}
