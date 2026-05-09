import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Plans + prices: source of truth for what we sell.
 *
 * The admin UI edits these rows; on save, a server action mirrors them
 * into Stripe (creates Product if missing, creates new Price + archives
 * the old one — Stripe Prices are immutable). `stripeProductId` and
 * `stripePriceId` are filled by that sync.
 */
export const planSlug = pgEnum('plan_slug', ['free', 'pro', 'teams']);
export const billingInterval = pgEnum('billing_interval', ['month', 'year']);
export const billingCurrency = pgEnum('billing_currency', ['eur', 'usd', 'ron']);

export const plans = pgTable('plans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: planSlug('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  /** Free-form marketing bullets shown in the pricing UI. */
  features: jsonb('features')
    .$type<string[]>()
    .notNull()
    .default([] as never),
  /**
   * Hard limits enforced server-side. Use null/undefined for "unlimited".
   * Keys: notesCloud, attachmentBytes, historyDays, devices, stickiesOpen,
   * aiActionsMonthly.
   */
  limits: jsonb('limits')
    .$type<{
      notesCloud?: number | null;
      attachmentBytes?: number | null;
      historyDays?: number | null;
      devices?: number | null;
      stickiesOpen?: number | null;
      aiActionsMonthly?: number | null;
    }>()
    .notNull()
    .default({} as never),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Filled when the plan has a Stripe Product (free plan stays null). */
  stripeProductId: text('stripe_product_id'),
  trialDays: integer('trial_days').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const planPrices = pgTable(
  'plan_prices',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    currency: billingCurrency('currency').notNull(),
    interval: billingInterval('interval').notNull(),
    /** Smallest currency unit (cents / bani). */
    unitAmount: integer('unit_amount').notNull(),
    stripePriceId: text('stripe_price_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('plan_prices_plan_currency_interval_unq').on(t.planId, t.currency, t.interval),
  ],
);

/**
 * Per-user, per-month usage counters. Keyed by `(userId, periodStart)`
 * with `periodStart` truncated to the first of the month UTC. Cheap to
 * read for the gate; cron resets at month boundary by inserting new rows.
 */
export const usageCounters = pgTable(
  'usage_counters',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    aiActions: integer('ai_actions').notNull().default(0),
    exportsRun: integer('exports_run').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('usage_counters_pk').on(t.userId, t.periodStart),
    index('usage_counters_period_idx').on(t.periodStart),
  ],
);

/** One row per active client device per user, refreshed on app boot. */
export const userDevices = pgTable(
  'user_devices',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Stable client-generated id (localStorage on web, app data on desktop). */
    clientId: text('client_id').notNull(),
    label: text('label'),
    platform: text('platform'), // 'web' | 'desktop' | 'mobile'
    userAgent: text('user_agent'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_devices_user_client_unq').on(t.userId, t.clientId)],
);

export const referralStatus = pgEnum('referral_status', [
  'pending',
  'accepted',
  'credited',
  'expired',
]);

export const referrals = pgTable(
  'referrals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Short opaque code shared in the invite URL. */
    code: text('code').notNull().unique(),
    inviteeEmail: text('invitee_email'),
    inviteeUserId: text('invitee_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: referralStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    creditedAt: timestamp('credited_at', { withTimezone: true }),
  },
  (t) => [index('referrals_inviter_idx').on(t.inviterId)],
);

export type Plan = typeof plans.$inferSelect;
export type PlanPrice = typeof planPrices.$inferSelect;
