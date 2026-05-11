'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, users, notes, eq, and } from '@notai/db';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  return session.user;
}

const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(
    /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,
    'Use 3-40 letters, digits or hyphens (no leading/trailing hyphen).',
  );

const reservedHandles = new Set([
  'admin',
  'api',
  'app',
  'blog',
  'docs',
  'help',
  'home',
  'login',
  'logout',
  'notai',
  'p',
  'public',
  'settings',
  'share',
  'signin',
  'signup',
  'support',
  'u',
  'www',
]);

export async function setBlogHandle(input: { handle: string | null }): Promise<void> {
  const user = await requireUser();
  if (input.handle == null || input.handle.trim() === '') {
    await db.update(users).set({ blogHandle: null }).where(eq(users.id, user.id!));
    revalidatePath('/app/settings');
    return;
  }
  const handle = handleSchema.parse(input.handle);
  if (reservedHandles.has(handle)) throw new Error('That handle is reserved. Pick another.');
  const [conflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.blogHandle, handle))
    .limit(1);
  if (conflict && conflict.id !== user.id) throw new Error('Handle already taken.');
  await db.update(users).set({ blogHandle: handle }).where(eq(users.id, user.id!));
  revalidatePath('/app/settings');
  revalidatePath(`/u/${handle}`);
}

export async function setNoteBlogVisible(input: {
  noteId: string;
  visible: boolean;
}): Promise<void> {
  const user = await requireUser();
  if (input.visible) {
    const [row] = await db
      .select({ isEncrypted: notes.isEncrypted })
      .from(notes)
      .where(and(eq(notes.id, input.noteId), eq(notes.ownerId, user.id!)))
      .limit(1);
    if (row?.isEncrypted) {
      throw new Error('End-to-end encrypted notes cannot be published.');
    }
  }
  await db
    .update(notes)
    .set({ blogVisible: input.visible, updatedAt: new Date() })
    .where(and(eq(notes.id, input.noteId), eq(notes.ownerId, user.id!)));
  revalidatePath(`/app/n/${input.noteId}`);
}

/**
 * Set or clear the scheduled publish timestamp on a blog note. Pass
 * `null` to publish immediately (the index + RSS treat null as live).
 * Past timestamps are accepted and behave as immediate-live.
 */
export async function setNoteBlogPublishAt(input: {
  noteId: string;
  publishAt: Date | null;
}): Promise<void> {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ blogPublishAt: input.publishAt, updatedAt: new Date() })
    .where(and(eq(notes.id, input.noteId), eq(notes.ownerId, user.id!)));
  revalidatePath(`/app/n/${input.noteId}`);
}

export interface NoteBlogStatus {
  visible: boolean;
  publishAt: string | null;
  ownerHandle: string | null;
}

export async function getNoteBlogStatus(noteId: string): Promise<NoteBlogStatus | null> {
  const user = await requireUser();
  const [row] = await db
    .select({
      visible: notes.blogVisible,
      publishAt: notes.blogPublishAt,
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id!)))
    .limit(1);
  if (!row) return null;
  const [u] = await db
    .select({ blogHandle: users.blogHandle })
    .from(users)
    .where(eq(users.id, user.id!))
    .limit(1);
  return {
    visible: row.visible,
    publishAt: row.publishAt?.toISOString() ?? null,
    ownerHandle: u?.blogHandle ?? null,
  };
}
