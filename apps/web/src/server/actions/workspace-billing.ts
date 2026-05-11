'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  getWorkspaceSeatInfo,
} from '@/server/billing/workspace-checkout';
import { db, workspaceSubscriptions, workspaceMembers, workspaces, eq, and } from '@notai/db';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

async function assertRole(workspaceId: string, userId: string, allowed: Role[]): Promise<void> {
  const [owner] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
    .limit(1);
  if (owner) {
    if (!allowed.includes('owner')) throw new Error('Not allowed');
    return;
  }
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!m) throw new Error('Not a member of this workspace');
  if (!allowed.includes(m.role as Role)) throw new Error('Not allowed');
}

const startSchema = z.object({
  workspaceId: z.string().min(1),
  seats: z.coerce.number().int().min(1).max(500),
  interval: z.enum(['month', 'year']).default('month'),
  currency: z.enum(['eur', 'usd', 'ron']).default('eur'),
});

export async function startWorkspaceCheckout(input: z.input<typeof startSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const data = startSchema.parse(input);
  await assertRole(data.workspaceId, session.user.id, ['owner', 'admin']);
  const out = await createWorkspaceCheckoutSession({
    workspaceId: data.workspaceId,
    actorUserId: session.user.id,
    seats: data.seats,
    interval: data.interval,
    currency: data.currency,
  });
  redirect(out.url);
}

export async function openWorkspaceBillingPortal(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await assertRole(workspaceId, session.user.id, ['owner', 'admin']);
  const url = await createWorkspacePortalSession(workspaceId);
  redirect(url);
}

export async function getWorkspaceBilling(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await assertRole(workspaceId, session.user.id, ['owner', 'admin', 'editor', 'viewer']);
  const [sub] = await db
    .select()
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
    .limit(1);
  const seatInfo = await getWorkspaceSeatInfo(workspaceId);
  return {
    sub: sub
      ? {
          tier: sub.tier,
          status: sub.status,
          seats: sub.seats,
          interval: sub.interval,
          currency: sub.currency,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd === 1,
        }
      : null,
    seatInfo,
  };
}
