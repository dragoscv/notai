import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  db,
  subscriptions,
  workspaceSubscriptions,
  billingEvents,
  plans,
  planPrices,
  referrals,
  eq,
  and,
} from '@notai/db';
import { getStripe } from '@/server/stripe';
import { env } from '@notai/lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook handler.
 *
 * Verifies the signature, ignores duplicate events via the
 * `billing_events` idempotency table, and reflects each event into our
 * `subscriptions` row — including `planId`, `interval`, `currency`,
 * `trialEndsAt`, `cancelAtPeriodEnd` so the rest of the app can read the
 * full subscription shape without consulting Stripe.
 *
 * Also redeems referral credits when a subscription enters `active` for
 * the first time (status transition tracked via metadata.referralInviterId).
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe] signature verification failed', err);
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  // Idempotency: if we've seen this event id, skip handler logic.
  const inserted = await db
    .insert(billingEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });
  if (inserted.length === 0) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = (session.metadata?.workspaceId ?? '') as string;
        if (workspaceId) {
          const subscriptionId = session.subscription as string | null;
          const customerId = session.customer as string | null;
          if (!subscriptionId || !customerId) break;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertWorkspaceSubscription(workspaceId, customerId, sub);
          break;
        }
        const userId = (session.metadata?.userId ?? session.client_reference_id ?? '') as string;
        if (!userId) break;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        if (!subscriptionId || !customerId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(userId, customerId, sub);
        await maybeRedeemReferral(session.metadata?.referralInviterId, userId);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = (sub.metadata?.workspaceId ?? '') as string;
        const customerId = sub.customer as string;
        if (workspaceId) {
          await upsertWorkspaceSubscription(workspaceId, customerId, sub);
          break;
        }
        const userId = (sub.metadata?.userId ?? '') as string;
        if (!userId) break;
        await upsertSubscription(userId, customerId, sub);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[stripe] payment failed', invoice.id);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe] handler error', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

type SubStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

async function upsertSubscription(
  userId: string,
  customerId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const item = sub.items.data[0];
  const stripePriceId = item?.price.id ?? null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const cancelAtPeriodEnd = sub.cancel_at_period_end ? 1 : 0;
  const status = sub.status as SubStatus;

  let planId: string | null = (sub.metadata?.planId as string) ?? null;
  let planSlug: 'free' | 'pro' | 'teams' = 'free';
  let interval: 'month' | 'year' | null = null;
  let currency: 'eur' | 'usd' | 'ron' | null = null;

  if (stripePriceId) {
    const priceRow = await db.query.planPrices.findFirst({
      where: eq(planPrices.stripePriceId, stripePriceId),
    });
    if (priceRow) {
      planId = priceRow.planId;
      interval = priceRow.interval;
      currency = priceRow.currency;
    } else if (item?.price?.recurring?.interval) {
      interval = item.price.recurring.interval as 'month' | 'year';
      const cur = item.price.currency?.toLowerCase();
      if (cur === 'eur' || cur === 'usd' || cur === 'ron') currency = cur;
    }
  }

  if (planId) {
    const planRow = await db.query.plans.findFirst({ where: eq(plans.id, planId) });
    if (planRow) planSlug = planRow.slug;
  } else if (sub.metadata?.planSlug) {
    const slug = sub.metadata.planSlug as 'free' | 'pro' | 'teams';
    if (slug === 'free' || slug === 'pro' || slug === 'teams') planSlug = slug;
  }

  const tier: 'free' | 'pro' | 'teams' =
    status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid'
      ? 'free'
      : planSlug;

  const existing = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(subscriptions).values({
      userId,
      planId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId,
      tier,
      status,
      interval,
      currency,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      cancelAtPeriodEnd,
    });
  } else {
    await db
      .update(subscriptions)
      .set({
        planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId,
        tier,
        status,
        interval,
        currency,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
  }
}

/**
 * Mark a referral as accepted on first paid checkout.
 * for inviter + invitee is granted by a follow-up admin cron that issues
 * Stripe coupon codes; this records intent.
 */
async function maybeRedeemReferral(
  inviterId: string | null | undefined,
  inviteeId: string,
): Promise<void> {
  if (!inviterId || inviterId === inviteeId) return;
  await db
    .update(referrals)
    .set({ inviteeUserId: inviteeId, status: 'accepted', acceptedAt: new Date() })
    .where(and(eq(referrals.inviterId, inviterId), eq(referrals.status, 'pending')));
}

async function upsertWorkspaceSubscription(
  workspaceId: string,
  customerId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const item = sub.items.data[0];
  const stripePriceId = item?.price.id ?? null;
  const seats = Math.max(1, item?.quantity ?? 1);
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const cancelAtPeriodEnd = sub.cancel_at_period_end ? 1 : 0;
  const status = sub.status as SubStatus;

  let planId: string | null = (sub.metadata?.planId as string) ?? null;
  let planSlug: 'free' | 'pro' | 'teams' = 'free';
  let interval: 'month' | 'year' | null = null;
  let currency: 'eur' | 'usd' | 'ron' | null = null;

  if (stripePriceId) {
    const priceRow = await db.query.planPrices.findFirst({
      where: eq(planPrices.stripePriceId, stripePriceId),
    });
    if (priceRow) {
      planId = priceRow.planId;
      interval = priceRow.interval;
      currency = priceRow.currency;
    } else if (item?.price?.recurring?.interval) {
      interval = item.price.recurring.interval as 'month' | 'year';
      const cur = item.price.currency?.toLowerCase();
      if (cur === 'eur' || cur === 'usd' || cur === 'ron') currency = cur;
    }
  }

  if (planId) {
    const planRow = await db.query.plans.findFirst({ where: eq(plans.id, planId) });
    if (planRow) planSlug = planRow.slug;
  } else if (sub.metadata?.planSlug) {
    const slug = sub.metadata.planSlug as 'free' | 'pro' | 'teams';
    if (slug === 'free' || slug === 'pro' || slug === 'teams') planSlug = slug;
  }

  const tier: 'free' | 'pro' | 'teams' =
    status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid'
      ? 'free'
      : planSlug;

  const existing = await db
    .select({ workspaceId: workspaceSubscriptions.workspaceId })
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(workspaceSubscriptions).values({
      workspaceId,
      planId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId,
      tier,
      status,
      interval,
      currency,
      seats,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd,
    });
  } else {
    await db
      .update(workspaceSubscriptions)
      .set({
        planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId,
        tier,
        status,
        interval,
        currency,
        seats,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSubscriptions.workspaceId, workspaceId));
  }
}
