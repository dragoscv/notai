'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth, signOut } from '@/auth';
import {
  db,
  users,
  notes,
  folders,
  tags,
  noteTags,
  noteComments,
  apiKeys,
  webhookEndpoints,
  webauthnCredentials,
  userDevices,
  subscriptions,
  supportTickets,
  auditLog,
  eq,
} from '@notai/db';

/** Throws a user-visible error if the caller isn't signed in. */
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string; email?: string | null; name?: string | null };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(80, 'Name is too long'),
});

/**
 * Update the signed-in user's display name. Returns the new value so the UI
 * can reflect it optimistically.
 */
export async function updateProfile(input: z.input<typeof profileSchema>) {
  const user = await requireUser();
  const { name } = profileSchema.parse(input);

  await db.update(users).set({ name }).where(eq(users.id, user.id));

  // Layouts pull `session.user` from `auth()`; revalidate any cached
  // segment that shows the name.
  revalidatePath('/app', 'layout');
  return { name };
}

/**
 * Export every note belonging to the signed-in user as a JSON-serializable
 * object. The Settings UI turns this into a `.json` download client-side.
 */
export async function exportUserNotes() {
  const user = await requireUser();
  const rows = await db.select().from(notes).where(eq(notes.ownerId, user.id));
  return {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email ?? null, name: user.name ?? null },
    notes: rows,
  };
}

/**
 * GDPR Article 15 / 20 export. Returns every personal-data table the user
 * is the subject of, in a single JSON blob. Secrets (api key plaintext,
 * webhook signing secrets, encrypted user secrets) are intentionally
 * excluded \u2014 we only export metadata.
 */
export async function exportAllUserData() {
  const user = await requireUser();
  const uid = user.id;
  const [
    profile,
    notesRows,
    foldersRows,
    tagsRows,
    noteTagRows,
    commentRows,
    apiKeyRows,
    webhookRows,
    webauthnRows,
    deviceRows,
    subRows,
    ticketRows,
    auditRows,
  ] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, uid) }),
    db.select().from(notes).where(eq(notes.ownerId, uid)),
    db.select().from(folders).where(eq(folders.ownerId, uid)),
    db.select().from(tags).where(eq(tags.ownerId, uid)),
    db
      .select({ noteId: noteTags.noteId, tagId: noteTags.tagId })
      .from(noteTags)
      .innerJoin(notes, eq(notes.id, noteTags.noteId))
      .where(eq(notes.ownerId, uid)),
    db.select().from(noteComments).where(eq(noteComments.userId, uid)),
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, uid)),
    db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        isActive: webhookEndpoints.isActive,
        createdAt: webhookEndpoints.createdAt,
        lastSuccessAt: webhookEndpoints.lastSuccessAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, uid)),
    db
      .select({
        id: webauthnCredentials.credentialId,
        deviceType: webauthnCredentials.deviceType,
        transports: webauthnCredentials.transports,
        createdAt: webauthnCredentials.createdAt,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, uid)),
    db.select().from(userDevices).where(eq(userDevices.userId, uid)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, uid)),
    db.select().from(supportTickets).where(eq(supportTickets.userId, uid)),
    db.select().from(auditLog).where(eq(auditLog.actorId, uid)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    profile,
    notes: notesRows,
    folders: foldersRows,
    tags: tagsRows,
    noteTags: noteTagRows,
    comments: commentRows,
    apiKeys: apiKeyRows,
    webhookEndpoints: webhookRows,
    webauthnCredentials: webauthnRows,
    devices: deviceRows,
    subscriptions: subRows,
    supportTickets: ticketRows,
    auditLog: auditRows,
  };
}

const deleteSchema = z.object({
  confirmEmail: z.string().email(),
});

/**
 * Permanently delete the signed-in user's account. All notes, tags,
 * collaborators and sessions cascade-delete via foreign-key constraints.
 * Requires the user to retype their own email as confirmation.
 */
export async function deleteAccount(input: z.input<typeof deleteSchema>) {
  const user = await requireUser();
  const { confirmEmail } = deleteSchema.parse(input);

  if (!user.email || confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('Email confirmation does not match');
  }

  await db.delete(users).where(eq(users.id, user.id));
  await signOut({ redirectTo: '/' });
}
