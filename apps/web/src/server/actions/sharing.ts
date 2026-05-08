'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, noteInvites, users, eq, and, or, sql } from '@notai/db';
import { sendEmail } from '@/server/email';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string; email?: string | null; name?: string | null };
}

/** Asserts the caller owns the note (only owners can manage sharing). */
async function requireOwner(noteId: string, userId: string) {
  const [n] = await db
    .select({ id: notes.id, title: notes.title, ownerId: notes.ownerId })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!n) throw new Error('Note not found or not owned by you');
  return n;
}

export type ShareRow =
  | {
      kind: 'collaborator';
      userId: string;
      email: string | null;
      name: string | null;
      image: string | null;
      role: 'owner' | 'editor' | 'viewer';
      addedAt: string;
    }
  | {
      kind: 'invite';
      inviteId: string;
      email: string;
      role: 'editor' | 'viewer';
      expiresAt: string;
    };

/** Returns the owner, accepted collaborators, and pending invites for a note. */
export async function listShare(noteId: string): Promise<ShareRow[]> {
  const me = await requireUser();
  const [note] = await db
    .select({ id: notes.id, ownerId: notes.ownerId })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, me.id)),
    )
    .where(
      and(eq(notes.id, noteId), or(eq(notes.ownerId, me.id), eq(noteCollaborators.userId, me.id))),
    )
    .limit(1);
  if (!note) throw new Error('Note not found');

  const [owner] = await db
    .select({ id: users.id, email: users.email, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, note.ownerId))
    .limit(1);

  const collabs = await db
    .select({
      userId: noteCollaborators.userId,
      role: noteCollaborators.role,
      addedAt: noteCollaborators.addedAt,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(noteCollaborators)
    .innerJoin(users, eq(users.id, noteCollaborators.userId))
    .where(eq(noteCollaborators.noteId, noteId));

  const pending = await db
    .select()
    .from(noteInvites)
    .where(and(eq(noteInvites.noteId, noteId), sql`accepted_at IS NULL`));

  const rows: ShareRow[] = [];
  if (owner) {
    rows.push({
      kind: 'collaborator',
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      image: owner.image,
      role: 'owner',
      addedAt: new Date(0).toISOString(),
    });
  }
  for (const c of collabs) {
    rows.push({
      kind: 'collaborator',
      userId: c.userId,
      email: c.email,
      name: c.name,
      image: c.image,
      role: c.role,
      addedAt: c.addedAt.toISOString(),
    });
  }
  for (const inv of pending) {
    rows.push({
      kind: 'invite',
      inviteId: inv.id,
      email: inv.email,
      role: inv.role === 'owner' ? 'editor' : inv.role,
      expiresAt: inv.expiresAt.toISOString(),
    });
  }
  return rows;
}

const inviteSchema = z.object({
  noteId: z.string().min(1),
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  role: z.enum(['editor', 'viewer']),
});

/**
 * Add a collaborator by email. If the email matches an existing user we add
 * them straight to `note_collaborators`. Otherwise we create a pending
 * invite and email a one-click acceptance link.
 */
export async function inviteToNote(input: z.input<typeof inviteSchema>) {
  const me = await requireUser();
  const { noteId, email, role } = inviteSchema.parse(input);
  await requireOwner(noteId, me.id);

  // Don't invite yourself.
  if (me.email && me.email.toLowerCase() === email) {
    return { ok: true, status: 'already_owner' as const };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .insert(noteCollaborators)
      .values({ noteId, userId: existing.id, role })
      .onConflictDoUpdate({
        target: [noteCollaborators.noteId, noteCollaborators.userId],
        set: { role },
      });
    revalidatePath(`/app/n/${noteId}`);
    return { ok: true, status: 'added' as const };
  }

  // Stranger — issue a signed token (we store the SHA-256, send the raw).
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [invite] = await db
    .insert(noteInvites)
    .values({
      noteId,
      invitedBy: me.id,
      email,
      role,
      tokenHash,
      expiresAt,
    })
    .returning();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:15600';
  const acceptUrl = `${appUrl}/share/accept?token=${raw}`;
  const inviterName = me.name || me.email || 'Someone';
  const noteTitle =
    (await db.select({ title: notes.title }).from(notes).where(eq(notes.id, noteId)).limit(1))[0]
      ?.title ?? 'a note';

  await sendEmail({
    to: email,
    subject: `${inviterName} shared a note with you on Notai`,
    text: `${inviterName} shared "${noteTitle}" with you. Open: ${acceptUrl}\n\nThis link expires in 14 days.`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:system-ui,sans-serif;background:#faf6f1;padding:32px 0">
        <tr><td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
            <tr><td>
              <p style="font-size:14px;color:#7a6f63;margin:0 0 8px">Notai</p>
              <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;color:#2a241e">
                ${escapeHtml(inviterName)} shared a note with you
              </h1>
              <p style="margin:0 0 24px;line-height:1.55;color:#3d362e">
                You've been invited to collaborate on
                <strong>${escapeHtml(noteTitle)}</strong> as a <em>${role}</em>.
              </p>
              <p style="margin:0 0 24px">
                <a href="${acceptUrl}"
                   style="display:inline-block;background:#c2410c;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:600">
                  Open the note
                </a>
              </p>
              <p style="font-size:12px;color:#8a7e71;margin:0">
                Or copy this link: <br/><span style="word-break:break-all">${acceptUrl}</span>
              </p>
              <p style="font-size:11px;color:#a8998a;margin:24px 0 0">
                This invite expires in 14 days. If you didn't expect this, you can ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>`,
  });

  revalidatePath(`/app/n/${noteId}`);
  return { ok: true, status: 'invited' as const, inviteId: invite!.id };
}

const updateRoleSchema = z.object({
  noteId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['editor', 'viewer']),
});

export async function updateCollaboratorRole(input: z.input<typeof updateRoleSchema>) {
  const me = await requireUser();
  const { noteId, userId, role } = updateRoleSchema.parse(input);
  await requireOwner(noteId, me.id);
  await db
    .update(noteCollaborators)
    .set({ role })
    .where(and(eq(noteCollaborators.noteId, noteId), eq(noteCollaborators.userId, userId)));
  revalidatePath(`/app/n/${noteId}`);
}

export async function removeCollaborator(input: { noteId: string; userId: string }) {
  const me = await requireUser();
  await requireOwner(input.noteId, me.id);
  await db
    .delete(noteCollaborators)
    .where(
      and(eq(noteCollaborators.noteId, input.noteId), eq(noteCollaborators.userId, input.userId)),
    );
  revalidatePath(`/app/n/${input.noteId}`);
}

export async function revokeInvite(input: { inviteId: string; noteId: string }) {
  const me = await requireUser();
  await requireOwner(input.noteId, me.id);
  await db.delete(noteInvites).where(eq(noteInvites.id, input.inviteId));
  revalidatePath(`/app/n/${input.noteId}`);
}

/**
 * Called from /share/accept after the user signs in. Validates the raw token
 * matches a non-expired invite, then upserts the collaborator row. Returns
 * the noteId on success so the caller can redirect to it.
 */
export async function acceptInvite(rawToken: string): Promise<{ noteId: string } | null> {
  const me = await requireUser();
  if (!me.email) return null;

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const [invite] = await db
    .select()
    .from(noteInvites)
    .where(eq(noteInvites.tokenHash, tokenHash))
    .limit(1);

  if (!invite) return null;
  if (invite.acceptedAt) return { noteId: invite.noteId };
  if (invite.expiresAt.getTime() < Date.now()) return null;

  // Email match is enforced softly: anyone who has the link AND is signed in
  // can accept; this matches Google Docs / Notion behaviour. If you'd prefer
  // strict email-binding, uncomment the check below.
  // if (me.email.toLowerCase() !== invite.email) return null;

  await db
    .insert(noteCollaborators)
    .values({ noteId: invite.noteId, userId: me.id, role: invite.role })
    .onConflictDoUpdate({
      target: [noteCollaborators.noteId, noteCollaborators.userId],
      set: { role: invite.role },
    });
  await db.update(noteInvites).set({ acceptedAt: new Date() }).where(eq(noteInvites.id, invite.id));
  revalidatePath(`/app/n/${invite.noteId}`);
  return { noteId: invite.noteId };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
