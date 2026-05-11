'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import {
  db,
  workspaces,
  workspaceMembers,
  workspaceInvites,
  sharedFolders,
  folders,
  users,
  eq,
  and,
  or,
  inArray,
} from '@notai/db';

/**
 * Workspace + shared folder server actions. Backed by tables added in
 * migration 0017. The owner is implicitly an `owner` member; admins
 * can invite + remove members; editors can read + write shared notes;
 * viewers are read-only.
 */

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  memberCount: number;
}

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  // Owned workspaces.
  const owned = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId));
  // Member workspaces.
  const memberRows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));

  const ids = [...owned.map((w) => w.id), ...memberRows.map((w) => w.id)];
  const counts = ids.length
    ? await db
        .select({ id: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(inArray(workspaceMembers.workspaceId, ids))
    : [];
  const countByWs = counts.reduce<Record<string, number>>((acc, r) => {
    acc[r.id] = (acc[r.id] ?? 0) + 1;
    return acc;
  }, {});

  return [
    ...owned.map((w) => ({
      id: w.id,
      name: w.name,
      role: 'owner' as const,
      memberCount: (countByWs[w.id] ?? 0) + 1, // include owner
    })),
    ...memberRows.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role as WorkspaceSummary['role'],
      memberCount: countByWs[w.id] ?? 1,
    })),
  ];
}

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });
export async function createWorkspace(input: z.input<typeof createSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { name } = createSchema.parse(input);
  const [row] = await db
    .insert(workspaces)
    .values({ name, ownerId: session.user.id })
    .returning({ id: workspaces.id });
  revalidatePath('/app');
  return { id: row!.id };
}

export async function deleteWorkspace(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, session.user.id)));
  revalidatePath('/app');
}

const inviteSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email().toLowerCase(),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
});

export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<{ token: string; url: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { workspaceId, email, role } = inviteSchema.parse(input);
  // Only owner / admin can invite.
  await assertWorkspaceRole(workspaceId, session.user.id, ['owner', 'admin']);
  // Seat enforcement for paid workspace plans (Teams). Free is unlimited here.
  const { assertWorkspaceSeatAvailable } = await import('@/server/billing/workspace-checkout');
  await assertWorkspaceSeatAvailable(workspaceId, 1);
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db
    .insert(workspaceInvites)
    .values({
      workspaceId,
      email,
      role,
      invitedById: session.user.id,
      token,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [workspaceInvites.workspaceId, workspaceInvites.email],
      set: { token, role, expiresAt },
    });
  revalidatePath('/app');
  // The page generates an absolute URL when needed; we return the
  // path so the client can prefix `window.location.origin`.
  return { token, url: `/workspace/accept/${token}` };
}

export async function acceptInvite(token: string): Promise<{ workspaceId: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sign in to accept');
  const userId = session.user.id;
  const userEmail = (session.user.email ?? '').toLowerCase();
  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.token, token))
    .limit(1);
  if (!invite) throw new Error('Invite not found');
  if (invite.expiresAt.getTime() < Date.now()) throw new Error('Invite expired');
  if (invite.email !== userEmail) {
    throw new Error('This invite was sent to a different email address');
  }
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role: invite.role, acceptedAt: new Date() },
    });
  await db.delete(workspaceInvites).where(eq(workspaceInvites.token, token));
  revalidatePath('/app');
  return { workspaceId: invite.workspaceId };
}

export interface WorkspaceMemberRow {
  userId: string;
  email: string | null;
  name: string | null;
  role: WorkspaceSummary['role'];
  isOwner: boolean;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  await assertWorkspaceRole(workspaceId, session.user.id, ['owner', 'admin', 'editor', 'viewer']);
  const [ws] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) return [];
  const owner = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, ws.ownerId))
    .limit(1);
  const members = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  const out: WorkspaceMemberRow[] = [];
  if (owner[0]) {
    out.push({
      userId: owner[0].id,
      email: owner[0].email,
      name: owner[0].name,
      role: 'owner',
      isOwner: true,
    });
  }
  for (const m of members) {
    if (m.userId === ws.ownerId) continue;
    out.push({
      userId: m.userId,
      email: m.email,
      name: m.name,
      role: m.role as WorkspaceSummary['role'],
      isOwner: false,
    });
  }
  return out;
}

export async function removeMember(input: { workspaceId: string; userId: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await assertWorkspaceRole(input.workspaceId, session.user.id, ['owner', 'admin']);
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.userId),
      ),
    );
  revalidatePath('/app');
}

const shareFolderSchema = z.object({
  folderId: z.string().min(1),
  workspaceId: z.string().min(1),
  role: z.enum(['editor', 'viewer']).default('editor'),
});
export async function shareFolderWithWorkspace(input: z.input<typeof shareFolderSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { folderId, workspaceId, role } = shareFolderSchema.parse(input);
  // Folder owner must also be a workspace owner/admin.
  const [folder] = await db
    .select({ ownerId: folders.ownerId })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);
  if (!folder || folder.ownerId !== session.user.id) {
    throw new Error('Folder not found');
  }
  await assertWorkspaceRole(workspaceId, session.user.id, ['owner', 'admin']);
  await db
    .insert(sharedFolders)
    .values({ folderId, workspaceId, role })
    .onConflictDoUpdate({
      target: [sharedFolders.folderId, sharedFolders.workspaceId],
      set: { role },
    });
  revalidatePath('/app');
}

export async function unshareFolder(input: { folderId: string; workspaceId: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const [folder] = await db
    .select({ ownerId: folders.ownerId })
    .from(folders)
    .where(eq(folders.id, input.folderId))
    .limit(1);
  if (!folder || folder.ownerId !== session.user.id) {
    throw new Error('Folder not found');
  }
  await db
    .delete(sharedFolders)
    .where(
      and(
        eq(sharedFolders.folderId, input.folderId),
        eq(sharedFolders.workspaceId, input.workspaceId),
      ),
    );
  revalidatePath('/app');
}

async function assertWorkspaceRole(
  workspaceId: string,
  userId: string,
  allowed: Array<WorkspaceSummary['role']>,
): Promise<WorkspaceSummary['role']> {
  const [owner] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
    .limit(1);
  if (owner) return 'owner';
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!m) throw new Error('Not a member of this workspace');
  const role = m.role as WorkspaceSummary['role'];
  if (!allowed.includes(role)) throw new Error('Not allowed');
  return role;
}

// Quiet unused-import warnings if helpers ever drop refs.
void or;
