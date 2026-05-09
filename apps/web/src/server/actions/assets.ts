'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, assets, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { buildKey, isAssetsConfigured, presign, publicUrlFor } from '@/server/storage/s3';
import { requireQuota } from '@/server/plans';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string; email?: string | null; name?: string | null };
}

async function requireNoteAccess(noteId: string, userId: string) {
  const [row] = await db
    .select({ id: notes.id, ownerId: notes.ownerId })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        eq(notes.id, noteId),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Note not found');
  return row;
}

const startSchema = z.object({
  noteId: z.string().min(1),
  filename: z.string().min(1).max(200),
  mime: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

/**
 * Step 1 of the upload: validate, allocate a key, return a presigned PUT
 * URL the client can stream the file to directly. Avoids piping bytes
 * through Vercel's body limits.
 */
export async function startAssetUpload(input: z.input<typeof startSchema>) {
  const me = await requireUser();
  const { noteId, filename, mime, sizeBytes } = startSchema.parse(input);

  if (!isAssetsConfigured()) {
    throw new Error('File uploads are not configured on this deployment');
  }
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('That file type is not supported');
  }

  await requireQuota(me.id, 'attachments', sizeBytes);

  await requireNoteAccess(noteId, me.id);
  const key = buildKey({ noteId, ownerId: me.id, filename, mime });
  const uploadUrl = presign({
    method: 'PUT',
    key,
    contentType: mime,
    expiresInSeconds: 300,
  });
  const publicUrl = publicUrlFor(key);
  void sizeBytes;
  return { uploadUrl, key, publicUrl };
}

const finishSchema = z.object({
  noteId: z.string().min(1),
  key: z.string().min(1),
  mime: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
  url: z.string().url(),
});

/** Step 2: client confirms the PUT succeeded; we record the asset row. */
export async function finishAssetUpload(input: z.input<typeof finishSchema>) {
  const me = await requireUser();
  const { noteId, mime, sizeBytes, url } = finishSchema.parse(input);
  await requireNoteAccess(noteId, me.id);
  const [row] = await db
    .insert(assets)
    .values({ noteId, ownerId: me.id, url, mime, sizeBytes })
    .returning();
  return row;
}

/** Returns assets attached to a note (most recent first). */
export async function listAssets(noteId: string) {
  const me = await requireUser();
  await requireNoteAccess(noteId, me.id);
  return db.select().from(assets).where(eq(assets.noteId, noteId));
}
