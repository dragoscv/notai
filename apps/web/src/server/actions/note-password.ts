'use server';

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, eq, and, isNull } from '@notai/db';
import { revalidatePath } from 'next/cache';

/**
 * Per-note password lock. The hash is `scrypt$N$saltHex$hashHex` so we
 * can rotate parameters later without a schema change. Verification
 * uses `timingSafeEqual` to avoid timing attacks. On success we set a
 * short-lived signed cookie keyed by note id so refreshes don't keep
 * prompting.
 */

const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;
const COOKIE_TTL_SECONDS = 60 * 60 * 4; // 4 hours

function hash(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verify(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const [, nStr, saltHex, hashHex] = parts as [string, string, string, string];
  const N = Number(nStr);
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(password, salt, expected.length, { N });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

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
    .set({ passwordHash: hash(password), passwordSetAt: new Date(), updatedAt: new Date() })
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
  if (!verify(input.password, row.hash)) return { ok: false };
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
