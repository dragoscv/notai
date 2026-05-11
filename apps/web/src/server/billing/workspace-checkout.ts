import 'server-only';
import {
  db,
  eq,
  and,
  plans,
  planPrices,
  workspaceSubscriptions,
  workspaces,
  workspaceMembers,
  users,
  sql,
  type BillingCurrency,
  type BillingInterval,
} from '@notai/db';
import { getStripe } from '@/server/stripe';
import { env } from '@notai/lib';
import { syncPlanToStripe } from './sync-stripe';

export interface WorkspaceCheckoutInput {
  workspaceId: string;
  /** The user initiating checkout — must be owner/admin of the workspace. */
  actorUserId: string;
  interval: BillingInterval;
  currency: BillingCurrency;
  seats: number;
  returnPath?: string;
}

export async function createWorkspaceCheckoutSession(
  input: WorkspaceCheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error('BILLING_NOT_CONFIGURED');

  const seats = Math.max(1, Math.floor(input.seats));

  const plan = await db.query.plans.findFirst({ where: eq(plans.slug, 'teams') });
  if (!plan) throw new Error('PLAN_NOT_FOUND');
  if (!plan.isActive) throw new Error('PLAN_INACTIVE');

  let price = await db.query.planPrices.findFirst({
    where: and(
      eq(planPrices.planId, plan.id),
      eq(planPrices.currency, input.currency),
      eq(planPrices.interval, input.interval),
    ),
  });
  if (!price) throw new Error('PRICE_NOT_FOUND');
  if (!price.stripePriceId) {
    await syncPlanToStripe(plan.id);
    price = await db.query.planPrices.findFirst({
      where: and(
        eq(planPrices.planId, plan.id),
        eq(planPrices.currency, input.currency),
        eq(planPrices.interval, input.interval),
      ),
    });
    if (!price?.stripePriceId) throw new Error('STRIPE_SYNC_FAILED');
  }

  const [ws] = await db
    .select({ ownerId: workspaces.ownerId, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.actorUserId))
    .limit(1);
  if (!user?.email) throw new Error('USER_EMAIL_MISSING');

  const [existing] = await db
    .select({ stripeCustomerId: workspaceSubscriptions.stripeCustomerId })
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, input.workspaceId))
    .limit(1);

  const origin = env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';
  const returnPath = input.returnPath ?? `/app/workspaces/${input.workspaceId}/billing`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: price.stripePriceId!, quantity: seats }],
    success_url: `${origin}${returnPath}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPath}?status=cancelled`,
    customer: existing?.stripeCustomerId ?? undefined,
    customer_email: existing?.stripeCustomerId ? undefined : user.email,
    client_reference_id: `ws:${input.workspaceId}`,
    allow_promotion_codes: true,
    metadata: {
      workspaceId: input.workspaceId,
      planId: plan.id,
      planSlug: plan.slug,
      priceId: price.id,
      currency: price.currency,
      interval: price.interval,
      seats: String(seats),
    },
    subscription_data: {
      metadata: {
        workspaceId: input.workspaceId,
        planId: plan.id,
        planSlug: plan.slug,
        priceId: price.id,
        currency: price.currency,
        interval: price.interval,
        seats: String(seats),
      },
    },
  });

  if (!session.url) throw new Error('STRIPE_NO_URL');
  return { url: session.url, sessionId: session.id };
}

export async function createWorkspacePortalSession(
  workspaceId: string,
  returnPath?: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('BILLING_NOT_CONFIGURED');
  const [row] = await db
    .select({ stripeCustomerId: workspaceSubscriptions.stripeCustomerId })
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
    .limit(1);
  if (!row?.stripeCustomerId) throw new Error('NO_STRIPE_CUSTOMER');
  const origin = env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}${returnPath ?? `/app/workspaces/${workspaceId}/billing`}`,
  });
  return portal.url;
}

/**
 * Return seat info: configured seats + current member count.
 * Free workspaces report seats=Infinity (no enforcement).
 */
export async function getWorkspaceSeatInfo(workspaceId: string) {
  const [sub] = await db
    .select()
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
    .limit(1);
  const [{ memberCount = 0 } = { memberCount: 0 }] = await db
    .select({ memberCount: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  const seats = sub && sub.tier !== 'free' && sub.status === 'active' ? sub.seats : null;
  return {
    tier: sub?.tier ?? 'free',
    status: sub?.status ?? 'active',
    seats,
    memberCount,
    seatsAvailable: seats == null ? null : Math.max(0, seats - memberCount),
  };
}

/**
 * Throw if adding `n` members would exceed paid seat quota.
 * Free workspaces are unbounded here — quota is enforced elsewhere.
 */
export async function assertWorkspaceSeatAvailable(workspaceId: string, additionalMembers = 1) {
  const info = await getWorkspaceSeatInfo(workspaceId);
  if (info.seats == null) return; // free / no paid sub → no seat enforcement
  if (info.memberCount + additionalMembers > info.seats) {
    throw new Error(`SEAT_LIMIT_REACHED:${info.seats}`);
  }
}
