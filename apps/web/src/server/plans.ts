import 'server-only';
import { cache } from 'react';
import {
  db,
  eq,
  and,
  count,
  isNull,
  sql,
  notes,
  subscriptions,
  plans,
  usageCounters,
  userDevices,
  type Plan,
} from '@notai/db';
import { getViewer } from './rbac';

/** Hard-coded fallback when the DB has no plans yet (very first deploy). */
const SAFE_FALLBACK_LIMITS = {
  notesCloud: 50,
  attachmentBytes: 50 * 1024 * 1024,
  historyDays: 7,
  devices: 3,
  stickiesOpen: 3,
  aiActionsMonthly: 0,
} as const;

export interface PlanContext {
  /** The user's current subscription tier, denormalized. */
  tier: 'free' | 'pro' | 'teams';
  /** Resolved plan record (the one the subscription points at). */
  plan: Plan | null;
  status:
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid'
    | 'paused';
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  /** True when the plan is Pro/Teams and not past-due/canceled. */
  isPro: boolean;
}

export const getPlanContext = cache(async (): Promise<PlanContext | null> => {
  const viewer = await getViewer();
  if (!viewer?.id) return null;
  return getPlanContextForUser(viewer.id);
});

export async function getPlanContextForUser(userId: string): Promise<PlanContext> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  let plan: Plan | null = null;
  if (sub?.planId) {
    plan = (await db.query.plans.findFirst({ where: eq(plans.id, sub.planId) })) ?? null;
  }
  // No row yet → treat as free.
  if (!sub) {
    plan = (await db.query.plans.findFirst({ where: eq(plans.slug, 'free') })) ?? null;
    return {
      tier: 'free',
      plan,
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isPro: false,
    };
  }
  const isProActive =
    (sub.tier === 'pro' || sub.tier === 'teams') &&
    (sub.status === 'active' || sub.status === 'trialing');
  return {
    tier: sub.tier,
    plan,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    isPro: isProActive,
  };
}

export interface QuotaState {
  notes: { used: number; limit: number | null };
  attachments: { used: number; limit: number | null };
  devices: { used: number; limit: number | null };
  ai: { used: number; limit: number | null; periodStart: Date };
  history: { days: number | null };
  stickiesOpen: { limit: number | null };
}

function effectiveLimits(plan: Plan | null) {
  if (!plan) return SAFE_FALLBACK_LIMITS;
  return { ...SAFE_FALLBACK_LIMITS, ...(plan.limits ?? {}) };
}

function startOfMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getQuotaState(userId: string): Promise<QuotaState> {
  const ctx = await getPlanContextForUser(userId);
  const limits = effectiveLimits(ctx.plan);

  const notesCountRow = await db
    .select({ value: count() })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt)));
  const notesCount = notesCountRow[0]?.value ?? 0;

  // Storage estimate: today we don't have a per-user attachment registry
  // wired up, so report 0. The Phase 4 storage gate will populate this.
  const attachmentsUsed = 0;

  const periodStart = startOfMonthUtc();
  const usage = await db.query.usageCounters.findFirst({
    where: and(eq(usageCounters.userId, userId), eq(usageCounters.periodStart, periodStart)),
  });

  const deviceCountRow = await db
    .select({ value: count() })
    .from(userDevices)
    .where(eq(userDevices.userId, userId));
  const deviceCount = deviceCountRow[0]?.value ?? 0;

  return {
    notes: { used: notesCount, limit: limits.notesCloud ?? null },
    attachments: { used: attachmentsUsed, limit: limits.attachmentBytes ?? null },
    devices: { used: deviceCount, limit: limits.devices ?? null },
    ai: {
      used: usage?.aiActions ?? 0,
      limit: limits.aiActionsMonthly ?? null,
      periodStart,
    },
    history: { days: limits.historyDays ?? null },
    stickiesOpen: { limit: limits.stickiesOpen ?? null },
  };
}

/**
 * Throws a `QuotaExceededError` when the user has hit a hard limit. Use at
 * the top of any server action that creates a billable resource.
 */
export class QuotaExceededError extends Error {
  constructor(
    public quota: keyof QuotaState,
    public used: number,
    public limit: number,
  ) {
    super(`Quota exceeded: ${quota} (${used}/${limit})`);
    this.name = 'QuotaExceededError';
  }
}

export async function requireQuota(
  userId: string,
  quota: 'notes' | 'attachments' | 'devices' | 'ai',
  delta = 1,
): Promise<void> {
  const state = await getQuotaState(userId);
  const slot = state[quota];
  if (slot.limit === null) return; // unlimited
  if (slot.used + delta > slot.limit) {
    throw new QuotaExceededError(quota, slot.used, slot.limit);
  }
}

/** Increment the AI action counter atomically (creates the row if missing). */
export async function incrementAiUsage(userId: string, delta = 1): Promise<void> {
  const periodStart = startOfMonthUtc();
  await db
    .insert(usageCounters)
    .values({ userId, periodStart, aiActions: delta })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.periodStart],
      set: {
        aiActions: sql`${usageCounters.aiActions} + ${delta}`,
        updatedAt: sql`now()`,
      },
    });
}

/** Convenience for actions that should fail when the user isn't on Pro. */
export async function requirePro(): Promise<void> {
  const ctx = await getPlanContext();
  if (!ctx?.isPro) {
    throw new Error('PRO_REQUIRED');
  }
}
