'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, subscriptions, eq, type BillingCurrency, type BillingInterval } from '@notai/db';
import {
  createCheckoutSession,
  createPortalSession,
  type CheckoutInput,
} from '@/server/billing/checkout';
import { syncAllPlansToStripe, syncPlanToStripe } from '@/server/billing/sync-stripe';
import { requirePermission } from '@/server/rbac';
import { audit } from '@/server/audit';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string; email: string | null; name: string | null };
}

/**
 * Returns the current user's plan tier + subscription status.
 */
export async function getMyPlan() {
  const me = await requireUser();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, me.id))
    .limit(1);
  if (!row)
    return {
      tier: 'free' as const,
      status: 'active' as const,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      interval: null,
      currency: null,
      trialEndsAt: null,
    };
  return {
    tier: row.tier,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === 1,
    interval: row.interval,
    currency: row.currency,
    trialEndsAt: row.trialEndsAt,
  };
}

/** True iff the user is on Pro/Teams AND their subscription is in good standing. */
export async function isPro(userId: string) {
  const [row] = await db
    .select({ tier: subscriptions.tier, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (!row) return false;
  return (
    (row.tier === 'pro' || row.tier === 'teams') &&
    (row.status === 'active' || row.status === 'trialing')
  );
}

/**
 * Legacy entry point used by the existing Settings → Billing panel.
 * Maps the old `{ interval: 'monthly' | 'yearly' }` shape to the new
 * dynamic checkout (defaults to Pro / EUR).
 */
export async function startCheckout(input: { interval: 'monthly' | 'yearly' }) {
  const me = await requireUser();
  const session = await createCheckoutSession({
    userId: me.id,
    planSlug: 'pro',
    currency: 'eur',
    interval: input.interval === 'yearly' ? 'year' : 'month',
  });
  redirect(session.url);
}

/**
 * New flexible checkout used by the pricing page. Supports any plan,
 * interval, currency, and an optional referral inviter id.
 */
export async function startDynamicCheckout(input: {
  planSlug: 'pro' | 'teams';
  interval: BillingInterval;
  currency: BillingCurrency;
  quantity?: number;
  referralInviterId?: string | null;
  returnPath?: string;
}) {
  const me = await requireUser();
  const payload: CheckoutInput = {
    userId: me.id,
    planSlug: input.planSlug,
    interval: input.interval,
    currency: input.currency,
    quantity: input.quantity,
    referralInviterId: input.referralInviterId ?? null,
    returnPath: input.returnPath,
  };
  const session = await createCheckoutSession(payload);
  redirect(session.url);
}

/** Open the Stripe customer portal for plan management / cancellation. */
export async function openBillingPortal() {
  const me = await requireUser();
  const url = await createPortalSession(me.id);
  revalidatePath('/app/settings/billing');
  redirect(url);
}

/**
 * Admin-only: push every plan + price into Stripe. Idempotent.
 */
export async function adminSyncAllPlans() {
  await requirePermission('plans:write');
  const result = await syncAllPlansToStripe();
  await audit({
    action: 'plans.sync_stripe.all',
    resourceType: 'plans',
    metadata: { summary: result as unknown as Record<string, unknown> },
  });
  revalidatePath('/admin/plans');
  return result;
}

/** Admin-only: sync a single plan to Stripe. */
export async function adminSyncPlan(planId: string) {
  await requirePermission('plans:write');
  const result = await syncPlanToStripe(planId);
  await audit({
    action: 'plans.sync_stripe.one',
    resourceType: 'plans',
    resourceId: planId,
    metadata: result as unknown as Record<string, unknown>,
  });
  revalidatePath('/admin/plans');
  return result;
}
