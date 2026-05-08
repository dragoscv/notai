'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, subscriptions, users, eq } from '@notai/db';
import { getStripe, PRICE_IDS } from '@/server/stripe';
import { env } from '@notai/lib';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string; email: string | null; name: string | null };
}

/**
 * Returns the current user's plan tier + subscription status. If they
 * have no row yet they're implicitly on the free tier.
 */
export async function getMyPlan() {
  const me = await requireUser();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, me.id))
    .limit(1);
  if (!row) return { tier: 'free' as const, status: 'active' as const, currentPeriodEnd: null };
  return {
    tier: row.tier,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === 1,
  };
}

/** True iff the user is on Pro AND their subscription is in good standing. */
export async function isPro(userId: string) {
  const [row] = await db
    .select({ tier: subscriptions.tier, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (!row) return false;
  return row.tier === 'pro' && (row.status === 'active' || row.status === 'trialing');
}

/**
 * Server action invoked by the Upgrade button. Creates a Stripe Checkout
 * session and redirects the browser to Stripe's hosted page.
 */
export async function startCheckout(input: { interval: 'monthly' | 'yearly' }) {
  const me = await requireUser();
  const stripe = getStripe();
  if (!stripe) throw new Error('Billing is not configured');
  const priceId = input.interval === 'yearly' ? PRICE_IDS.proYearly : PRICE_IDS.proMonthly;
  if (!priceId) throw new Error('Missing Stripe price for the selected interval');

  // Reuse an existing customer if we have one, else let Checkout create it.
  const [existing] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, me.id))
    .limit(1);

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);

  const origin = env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app/settings/billing?status=success`,
    cancel_url: `${origin}/app/settings/billing?status=cancelled`,
    customer: existing?.stripeCustomerId ?? undefined,
    customer_email: existing?.stripeCustomerId ? undefined : user?.email ?? undefined,
    client_reference_id: me.id,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: { userId: me.id },
    subscription_data: {
      metadata: { userId: me.id },
    },
  });

  if (!session.url) throw new Error('Stripe did not return a redirect URL');
  redirect(session.url);
}

/** Open the Stripe customer portal for plan management / cancellation. */
export async function openBillingPortal() {
  const me = await requireUser();
  const stripe = getStripe();
  if (!stripe) throw new Error('Billing is not configured');
  const [row] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, me.id))
    .limit(1);
  if (!row?.stripeCustomerId) throw new Error('No Stripe customer on file');

  const origin = env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}/app/settings/billing`,
  });
  revalidatePath('/app/settings/billing');
  redirect(portal.url);
}
