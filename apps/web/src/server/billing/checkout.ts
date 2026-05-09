import 'server-only';
import {
  db,
  eq,
  and,
  plans,
  planPrices,
  subscriptions,
  users,
  type BillingCurrency,
  type BillingInterval,
} from '@notai/db';
import { getStripe } from '@/server/stripe';
import { env } from '@notai/lib';
import { syncPlanToStripe } from './sync-stripe';

export interface CheckoutInput {
  userId: string;
  planSlug: 'pro' | 'teams';
  interval: BillingInterval;
  currency: BillingCurrency;
  /** Where Stripe redirects after success/cancel; we append our own status query. */
  returnPath?: string;
  /** Quantity for per-seat plans (Teams). Defaults to 1. */
  quantity?: number;
  /** Override trial; null = use plan's default. */
  trialDays?: number | null;
  /** Optional inviter user id from a referral cookie. Stored on the subscription. */
  referralInviterId?: string | null;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Build a Stripe Checkout session for any plan/interval/currency combo.
 * Auto-syncs the plan to Stripe if the price has not been mirrored yet.
 */
export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) throw new Error('BILLING_NOT_CONFIGURED');

  const plan = await db.query.plans.findFirst({ where: eq(plans.slug, input.planSlug) });
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

  // Auto-sync if Stripe price id is missing.
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

  // Customer reuse: prefer an existing customer linked to this user.
  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, input.userId))
    .limit(1);
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user?.email) throw new Error('USER_EMAIL_MISSING');

  // Eligible for trial only on a user's first paid subscription.
  const trialDays = input.trialDays ?? plan.trialDays ?? 0;
  const isFirstPaidSub = !sub?.stripeCustomerId;

  const origin = env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';
  const returnPath = input.returnPath ?? '/app/settings/billing';
  const quantity = Math.max(1, input.quantity ?? 1);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: price.stripePriceId!, quantity }],
    success_url: `${origin}${returnPath}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPath}?status=cancelled`,
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId ? undefined : user.email,
    client_reference_id: input.userId,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: false },
    metadata: {
      userId: input.userId,
      planId: plan.id,
      planSlug: plan.slug,
      priceId: price.id,
      currency: price.currency,
      interval: price.interval,
      ...(input.referralInviterId ? { referralInviterId: input.referralInviterId } : {}),
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        planId: plan.id,
        planSlug: plan.slug,
        priceId: price.id,
        currency: price.currency,
        interval: price.interval,
        ...(input.referralInviterId ? { referralInviterId: input.referralInviterId } : {}),
      },
      ...(trialDays > 0 && isFirstPaidSub ? { trial_period_days: trialDays } : {}),
    },
  });

  if (!session.url) throw new Error('STRIPE_NO_URL');
  return { url: session.url, sessionId: session.id };
}

/**
 * Build a Stripe Customer Portal session so the user can manage / cancel
 * their subscription, swap card, download invoices.
 */
export async function createPortalSession(userId: string, returnPath?: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('BILLING_NOT_CONFIGURED');
  const [row] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (!row?.stripeCustomerId) throw new Error('NO_STRIPE_CUSTOMER');
  const origin = env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}${returnPath ?? '/app/settings/billing'}`,
  });
  return portal.url;
}
