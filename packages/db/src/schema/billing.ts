import { pgTable, text, timestamp, integer, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { plans, billingInterval, billingCurrency } from './plans';

export const planTier = pgEnum('plan_tier', ['free', 'pro', 'teams']);
export const subStatus = pgEnum('sub_status', [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
]);

/**
 * One row per user. We keep `tier` denormalised so feature gating doesn't
 * need to consult Stripe — webhooks update it. `planId` is the FK into
 * the editable `plans` table; `tier` mirrors `plans.slug` for fast reads.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: text('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    tier: planTier('tier').notNull().default('free'),
    status: subStatus('status').notNull().default('active'),
    interval: billingInterval('interval'),
    currency: billingCurrency('currency'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    cancelAtPeriodEnd: integer('cancel_at_period_end').notNull().default(0),
    /** True when the admin granted Pro (no Stripe invoice). */
    compReason: text('comp_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('subs_customer_unq').on(t.stripeCustomerId)],
);

/**
 * Idempotency record for processed Stripe webhook events. Stripe retries
 * webhooks aggressively; this table makes processing safe.
 */
export const billingEvents = pgTable('billing_events', {
  id: text('id').primaryKey(), // Stripe event id (evt_…)
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
