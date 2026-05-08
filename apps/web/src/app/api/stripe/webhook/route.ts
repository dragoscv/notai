import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db, subscriptions, billingEvents, eq } from '@notai/db';
import { getStripe } from '@/server/stripe';
import { env } from '@notai/lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook handler. Verifies the signature, ignores duplicate
 * events via the `billing_events` idempotency table, and reflects each
 * event into our `subscriptions` row.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  // We must use the raw body for signature verification.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe] signature verification failed', err);
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  // Idempotency: insert event id; if it already exists we exit cleanly.
  try {
    await db
      .insert(billingEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing();
  } catch (err) {
    console.error('[stripe] failed to record event', err);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.userId ?? session.client_reference_id ?? '') as string;
        if (!userId) break;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        if (!subscriptionId || !customerId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(userId, customerId, sub);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.userId ?? '') as string;
        const customerId = sub.customer as string;
        if (!userId) break;
        await upsertSubscription(userId, customerId, sub);
        break;
      }
      case 'invoice.payment_failed': {
        // Status update happens via the subscription update event,
        // so we just log here.
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[stripe] payment failed', invoice.id);
        break;
      }
      default:
        // Quiet — there are dozens of event types we don't care about.
        break;
    }
  } catch (err) {
    console.error('[stripe] handler error', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function upsertSubscription(
  userId: string,
  customerId: string,
  sub: Stripe.Subscription,
) {
  const tier: 'free' | 'pro' = sub.status === 'canceled' ? 'free' : 'pro';
  const status = sub.status as
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid'
    | 'paused';
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;
  const priceId = sub.items.data[0]?.price.id ?? null;
  const cancelAtPeriodEnd = sub.cancel_at_period_end ? 1 : 0;

  const existing = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      tier,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd,
    });
  } else {
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        tier,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
  }
}
