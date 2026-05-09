/**
 * Default plans + prices seeded into the DB on first boot.
 *
 * The admin UI later mirrors any changes here into Stripe (creates
 * Products + Prices, archives the old Price when amounts change).
 *
 * Yearly = 10 × monthly (≈17% discount, the standard SaaS framing).
 *
 * Limits are the hard caps enforced server-side by the gate helpers.
 * `null` = unlimited.
 */

type Slug = 'free' | 'pro' | 'teams';
type Currency = 'eur' | 'usd' | 'ron';
type Interval = 'month' | 'year';

interface DefaultPrice {
  currency: Currency;
  interval: Interval;
  /** Smallest currency unit (cents / bani). */
  unitAmount: number;
}

interface DefaultPlanLimits {
  notesCloud?: number | null;
  attachmentBytes?: number | null;
  historyDays?: number | null;
  devices?: number | null;
  stickiesOpen?: number | null;
  aiActionsMonthly?: number | null;
}

export interface DefaultPlan {
  slug: Slug;
  displayName: string;
  description: string;
  features: string[];
  limits: DefaultPlanLimits;
  trialDays: number;
  sortOrder: number;
  prices: DefaultPrice[];
}

const MB = 1024 * 1024;

export const DEFAULT_PLANS: DefaultPlan[] = [
  {
    slug: 'free',
    displayName: 'Free',
    description: 'For personal use. Local-first with limited cloud sync.',
    features: [
      'Unlimited local notes & drawings',
      'Cloud sync up to 50 notes',
      '50 MB attachments',
      '7 days of version history',
      '3 devices',
      'Up to 3 sticky notes open',
      'Markdown export',
    ],
    limits: {
      notesCloud: 50,
      attachmentBytes: 50 * MB,
      historyDays: 7,
      devices: 3,
      stickiesOpen: 3,
      aiActionsMonthly: 0,
    },
    trialDays: 0,
    sortOrder: 0,
    prices: [],
  },
  {
    slug: 'pro',
    displayName: 'Pro',
    description: 'Everything Free has, plus AI, unlimited storage, and more.',
    features: [
      'Unlimited cloud notes',
      '10 GB attachments',
      'Unlimited version history with named snapshots',
      'Unlimited devices',
      'Unlimited sticky notes',
      '500 AI actions / month (summarize, ask, transcribe)',
      'PDF, HTML, Notion, .zip export',
      'Public share links with custom slug + password',
      'Custom themes & app icons',
    ],
    limits: {
      notesCloud: null,
      attachmentBytes: 10 * 1024 * MB,
      historyDays: null,
      devices: null,
      stickiesOpen: null,
      aiActionsMonthly: 500,
    },
    trialDays: 14,
    sortOrder: 1,
    prices: [
      // EUR
      { currency: 'eur', interval: 'month', unitAmount: 500 }, // €5.00
      { currency: 'eur', interval: 'year', unitAmount: 5000 }, // €50.00
      // USD
      { currency: 'usd', interval: 'month', unitAmount: 500 }, // $5.00
      { currency: 'usd', interval: 'year', unitAmount: 5000 }, // $50.00
      // RON (1 EUR ≈ 5 RON, rounded to whole RON)
      { currency: 'ron', interval: 'month', unitAmount: 2500 }, // 25 RON
      { currency: 'ron', interval: 'year', unitAmount: 25000 }, // 250 RON
    ],
  },
  {
    slug: 'teams',
    displayName: 'Teams',
    description: 'Shared workspaces, SSO, and admin controls. Per seat.',
    features: [
      'Everything in Pro',
      'Shared workspaces with roles',
      '100 GB pooled storage',
      'Shared AI pool (1500 / seat / month)',
      'SSO (Google Workspace)',
      'Audit log + admin console',
      'Centralized billing',
    ],
    limits: {
      notesCloud: null,
      attachmentBytes: 100 * 1024 * MB,
      historyDays: null,
      devices: null,
      stickiesOpen: null,
      aiActionsMonthly: 1500,
    },
    trialDays: 14,
    sortOrder: 2,
    prices: [
      { currency: 'eur', interval: 'month', unitAmount: 900 }, // €9.00 / seat
      { currency: 'eur', interval: 'year', unitAmount: 9000 }, // €90.00 / seat
      { currency: 'usd', interval: 'month', unitAmount: 900 },
      { currency: 'usd', interval: 'year', unitAmount: 9000 },
      { currency: 'ron', interval: 'month', unitAmount: 4500 }, // 45 RON
      { currency: 'ron', interval: 'year', unitAmount: 45000 }, // 450 RON
    ],
  },
];

/** Hard-coded super-admin email — pre-seeded with super_admin role on every seed run. */
export const SUPER_ADMIN_EMAIL = 'vladulescu.catalin@gmail.com';
