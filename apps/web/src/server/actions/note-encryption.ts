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
  const { noteId, encryptedBody } = lockSchema.parse(input);
  await db
    .update(notes)
    .set({
      isEncrypted: true,
      encryptedBody,
      plaintext: '',
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)));
  revalidatePath(`/app/n/${noteId}`);
}

const unlockSchema = z.object({
  noteId: z.string().min(1),
  plaintext: z.string().max(2_000_000).optional(),
});

/**
 * Disable encryption on a note. Caller passes the freshly decrypted
 * plaintext so search / embeddings can re-index. The ciphertext is
 * cleared.
 */
export async function disableNoteEncryption(input: z.input<typeof unlockSchema>) {
  const userId = await requireUser();
  const { noteId, plaintext } = unlockSchema.parse(input);
  await db
    .update(notes)
    .set({
      isEncrypted: false,
      encryptedBody: null,
      plaintext: plaintext ?? '',
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)));
  revalidatePath(`/app/n/${noteId}`);
}

/**
 * Fetch the ciphertext blob for a locked note so the client can
 * decrypt it. Returns null when the note exists but isn't encrypted.
 */
export async function getNoteCiphertext(noteId: string): Promise<string | null> {
  const userId = await requireUser();
  const [row] = await db
    .select({ encryptedBody: notes.encryptedBody, isEncrypted: notes.isEncrypted })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!row || !row.isEncrypted) return null;
  return row.encryptedBody;
}
