'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, notes, eq, and } from '@notai/db';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user.id;
}

const lockSchema = z.object({
  noteId: z.string().min(1),
  encryptedBody: z.string().min(20).max(20_000_000),
  encryptedTitle: z.string().min(20).max(20_000).optional(),
});

/**
 * Mark a note as encrypted. The client has already encrypted the note's
 * plaintext content using the user's master key from `user_keys`;
 * server only persists the opaque ciphertext (base64 of `IV(12) || ciphertext`),
 * blanks `plaintext` so search/AI/embeddings stop seeing it, and flips
 * `isEncrypted`. The Y.Doc state on the realtime server is not touched
 * here — `disableNoteEncryption` is the only safe way back, and callers
 * should consider the Hocuspocus snapshot a separate confidentiality
 * surface (server admin can still read it). For true E2E privacy users
 * should keep a locked note out of collaborative sessions.
 */
export async function enableNoteEncryption(input: z.input<typeof lockSchema>) {
  const userId = await requireUser();
  const { noteId, encryptedBody, encryptedTitle } = lockSchema.parse(input);
  await db
    .update(notes)
    .set({
      isEncrypted: true,
      encryptedBody,
      encryptedTitle: encryptedTitle ?? null,
      title: '🔒 Encrypted note',
      plaintext: '',
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)));
  revalidatePath(`/app/n/${noteId}`);
}

const unlockSchema = z.object({
  noteId: z.string().min(1),
  plaintext: z.string().max(2_000_000).optional(),
  plaintextTitle: z.string().max(1000).optional(),
});

/**
 * Disable encryption on a note. Caller passes the freshly decrypted
 * plaintext (and optionally the decrypted title) so search /
 * embeddings can re-index. The ciphertext is cleared.
 */
export async function disableNoteEncryption(input: z.input<typeof unlockSchema>) {
  const userId = await requireUser();
  const { noteId, plaintext, plaintextTitle } = unlockSchema.parse(input);
  await db
    .update(notes)
    .set({
      isEncrypted: false,
      encryptedBody: null,
      encryptedTitle: null,
      plaintext: plaintext ?? '',
      ...(plaintextTitle ? { title: plaintextTitle } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)));
  revalidatePath(`/app/n/${noteId}`);
}

/**
 * Fetch the ciphertext blobs for a locked note so the client can
 * decrypt them. Returns null when the note exists but isn't encrypted.
 */
export async function getNoteCiphertext(
  noteId: string,
): Promise<{ encryptedBody: string | null; encryptedTitle: string | null } | null> {
  const userId = await requireUser();
  const [row] = await db
    .select({
      encryptedBody: notes.encryptedBody,
      encryptedTitle: notes.encryptedTitle,
      isEncrypted: notes.isEncrypted,
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!row || !row.isEncrypted) return null;
  return { encryptedBody: row.encryptedBody, encryptedTitle: row.encryptedTitle };
}
