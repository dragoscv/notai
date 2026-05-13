'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  eq,
  and,
  sql,
  desc,
  count,
  inArray,
  ilike,
  isNull,
  isNotNull,
  gte,
  users,
  sessions,
  notes,
  assets,
  subscriptions,
  plans,
  planPrices,
  auditLog,
  featureFlags,
  userFeatureFlags,
  broadcasts,
  userRoles,
  roles,
  type RoleName,
} from '@notai/db';
import {
  requirePermission,
  requireAdmin,
  getRolesForUsers,
  grantRole,
  revokeRole,
  getViewer,
} from '@/server/rbac';
import { audit } from '@/server/audit';
import { syncAllPlansToStripe, syncPlanToStripe } from '@/server/billing/sync-stripe';
import { getStripe } from '@/server/stripe';

// ───────────────────────────── Overview ──────────────────────────────

export async function getOverviewMetrics() {
  await requireAdmin();

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since1 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const totalUsers = (await db.select({ value: count() }).from(users))[0]?.value ?? 0;
  const totalNotes =
    (await db.select({ value: count() }).from(notes).where(isNull(notes.deletedAt)))[0]?.value ?? 0;

  const tierRows = await db
    .select({ tier: subscriptions.tier, value: count() })
    .from(subscriptions)
    .groupBy(subscriptions.tier);
  const tierMap = new Map(tierRows.map((r) => [r.tier, r.value]));
  const proUsers = (tierMap.get('pro') ?? 0) + (tierMap.get('teams') ?? 0);

  const dau =
    (
      await db
        .select({ value: count() })
        .from(users)
        .where(and(isNotNull(users.lastSeenAt), gte(users.lastSeenAt, since1)))
    )[0]?.value ?? 0;
  const wau =
    (
      await db
        .select({ value: count() })
        .from(users)
        .where(and(isNotNull(users.lastSeenAt), gte(users.lastSeenAt, since7)))
    )[0]?.value ?? 0;
  const mau =
    (
      await db
        .select({ value: count() })
        .from(users)
        .where(and(isNotNull(users.lastSeenAt), gte(users.lastSeenAt, since30)))
    )[0]?.value ?? 0;

  const newUsers30 =
    (await db.select({ value: count() }).from(users).where(gte(users.createdAt, since30)))[0]
      ?.value ?? 0;

  // MRR: sum of active sub unitAmount / interval (year=÷12).
  const activeSubs = await db
    .select({
      currency: subscriptions.currency,
      interval: subscriptions.interval,
      stripePriceId: subscriptions.stripePriceId,
    })
    .from(subscriptions)
    .where(inArray(subscriptions.status, ['active', 'trialing']));

  const priceIds = activeSubs.map((s) => s.stripePriceId).filter(Boolean) as string[];
  const priceMap = new Map<string, { unitAmount: number; currency: string; interval: string }>();
  if (priceIds.length > 0) {
    const priceRows = await db
      .select({
        stripePriceId: planPrices.stripePriceId,
        unitAmount: planPrices.unitAmount,
        currency: planPrices.currency,
        interval: planPrices.interval,
      })
      .from(planPrices)
      .where(inArray(planPrices.stripePriceId, priceIds));
    for (const row of priceRows) {
      if (row.stripePriceId) {
        priceMap.set(row.stripePriceId, {
          unitAmount: row.unitAmount,
          currency: row.currency,
          interval: row.interval,
        });
      }
    }
  }

  const mrrByCurrency: Record<string, number> = {};
  for (const sub of activeSubs) {
    if (!sub.stripePriceId) continue;
    const p = priceMap.get(sub.stripePriceId);
    if (!p) continue;
    const monthly = p.interval === 'year' ? p.unitAmount / 12 : p.unitAmount;
    mrrByCurrency[p.currency] = (mrrByCurrency[p.currency] ?? 0) + monthly;
  }

  return {
    totalUsers,
    totalNotes,
    proUsers,
    freeUsers: tierMap.get('free') ?? Math.max(0, totalUsers - proUsers),
    dau,
    wau,
    mau,
    newUsers30,
    mrrByCurrency,
  };
}

// ───────────────────────────── Users ──────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  lastSeenAt: Date | null;
  tier: 'free' | 'pro' | 'teams';
  subStatus: string | null;
  roles: string[];
  notesCount: number;
}

export async function listAdminUsers(input: {
  search?: string;
  tier?: 'all' | 'free' | 'pro' | 'teams';
  status?: 'all' | 'active' | 'suspended' | 'deleted';
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  await requirePermission('users:read');
  const limit = Math.min(100, Math.max(10, input.limit ?? 25));
  const offset = Math.max(0, input.offset ?? 0);

  const search = (input.search ?? '').trim();
  const tier = input.tier && input.tier !== 'all' ? input.tier : null;
  const status = input.status && input.status !== 'all' ? input.status : null;

  const conditions = [];
  if (search) {
    conditions.push(
      sql`(${users.email} ILIKE ${'%' + search + '%'} OR ${users.name} ILIKE ${'%' + search + '%'})`,
    );
  }
  if (status) conditions.push(eq(users.status, status));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      status: users.status,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      tier: subscriptions.tier,
      subStatus: subscriptions.status,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id));

  const filtered = whereClause ? baseQuery.where(whereClause) : baseQuery;
  let rows = await filtered.orderBy(desc(users.createdAt)).limit(limit).offset(offset);

  if (tier) {
    rows = rows.filter((r) => (r.tier ?? 'free') === tier);
  }

  const userIds = rows.map((r) => r.id);
  const rolesMap = await getRolesForUsers(userIds);

  let notesPerUser: Map<string, number> = new Map();
  if (userIds.length > 0) {
    const noteCounts = await db
      .select({ ownerId: notes.ownerId, value: count() })
      .from(notes)
      .where(and(isNull(notes.deletedAt), inArray(notes.ownerId, userIds)))
      .groupBy(notes.ownerId);
    notesPerUser = new Map(noteCounts.map((r) => [r.ownerId, r.value]));
  }

  const totalRow = whereClause
    ? await db.select({ value: count() }).from(users).where(whereClause)
    : await db.select({ value: count() }).from(users);
  const total = totalRow[0]?.value ?? 0;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      image: r.image,
      status: r.status,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
      tier: (r.tier ?? 'free') as 'free' | 'pro' | 'teams',
      subStatus: r.subStatus,
      roles: rolesMap.get(r.id) ?? [],
      notesCount: notesPerUser.get(r.id) ?? 0,
    })),
    total,
  };
}

export async function getAdminUser(userId: string) {
  await requirePermission('users:read');
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error('User not found');

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));

  const notesCount =
    (
      await db
        .select({ value: count() })
        .from(notes)
        .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    )[0]?.value ?? 0;

  const attachmentRow = await db
    .select({ value: sql<number>`coalesce(sum(${assets.sizeBytes}), 0)::bigint` })
    .from(assets)
    .where(eq(assets.ownerId, userId));

  return {
    user,
    subscription: sub ?? null,
    roles: roleRows.map((r) => r.name),
    notesCount,
    attachmentBytes: Number(attachmentRow[0]?.value ?? 0),
  };
}

export async function suspendUser(input: { userId: string; reason: string }) {
  await requirePermission('users:suspend');
  const before = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  await db
    .update(users)
    .set({
      status: 'suspended',
      suspendedAt: new Date(),
      suspendedReason: input.reason,
    })
    .where(eq(users.id, input.userId));
  await audit({
    action: 'user.suspend',
    resourceType: 'user',
    resourceId: input.userId,
    before: before ? { status: before.status } : null,
    after: { status: 'suspended', reason: input.reason },
  });
  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath('/admin/users');
}

export async function unsuspendUser(userId: string) {
  await requirePermission('users:suspend');
  await db
    .update(users)
    .set({ status: 'active', suspendedAt: null, suspendedReason: null })
    .where(eq(users.id, userId));
  await audit({
    action: 'user.unsuspend',
    resourceType: 'user',
    resourceId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/users');
}

/**
 * Invalidate every active database session for a user. The next request
 * from any of their devices will land on /signin. Auth.js does not have
 * a built-in admin "force logout"; we delete the rows directly.
 */
export async function forceLogoutUser(input: { userId: string; reason?: string }) {
  await requirePermission('users:suspend');
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, input.userId))
    .returning({ token: sessions.sessionToken });
  await audit({
    action: 'user.force_logout',
    resourceType: 'user',
    resourceId: input.userId,
    metadata: { revokedSessionCount: deleted.length, reason: input.reason ?? null },
  });
  revalidatePath(`/admin/users/${input.userId}`);
  return { revoked: deleted.length };
}

export async function adminGrantRole(input: { userId: string; roleName: RoleName }) {
  await requirePermission('users:assign_roles');
  const me = await getViewer();
  if (!me?.id) throw new Error('Not signed in');
  await grantRole(input.userId, input.roleName, me.id);
  await audit({
    action: 'user.role.grant',
    resourceType: 'user',
    resourceId: input.userId,
    metadata: { role: input.roleName },
  });
  revalidatePath(`/admin/users/${input.userId}`);
}

export async function adminRevokeRole(input: { userId: string; roleName: RoleName }) {
  await requirePermission('users:assign_roles');
  await revokeRole(input.userId, input.roleName);
  await audit({
    action: 'user.role.revoke',
    resourceType: 'user',
    resourceId: input.userId,
    metadata: { role: input.roleName },
  });
  revalidatePath(`/admin/users/${input.userId}`);
}

// ───────────────────────────── Plans ──────────────────────────────

export async function listAdminPlans() {
  await requirePermission('plans:read');
  const planRows = await db.query.plans.findMany({
    orderBy: (p, { asc }) => [asc(p.sortOrder)],
  });
  const priceRows = await db.query.planPrices.findMany();
  return planRows.map((p) => ({
    ...p,
    prices: priceRows.filter((pr) => pr.planId === p.id),
  }));
}

export async function updatePlan(input: {
  planId: string;
  displayName?: string;
  description?: string;
  features?: string[];
  isActive?: boolean;
  trialDays?: number;
  limits?: Record<string, number | null>;
}) {
  await requirePermission('plans:write');
  const before = await db.query.plans.findFirst({ where: eq(plans.id, input.planId) });
  if (!before) throw new Error('Plan not found');
  await db
    .update(plans)
    .set({
      displayName: input.displayName ?? before.displayName,
      description: input.description ?? before.description,
      features: input.features ?? before.features,
      isActive: input.isActive ?? before.isActive,
      trialDays: input.trialDays ?? before.trialDays,
      limits: (input.limits as never) ?? before.limits,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, input.planId));
  await audit({
    action: 'plan.update',
    resourceType: 'plan',
    resourceId: input.planId,
    before: before as unknown as Record<string, unknown>,
    after: input as unknown as Record<string, unknown>,
  });
  revalidatePath('/admin/plans');
}

export async function updatePrice(input: {
  priceId: string;
  unitAmount: number;
  isActive?: boolean;
}) {
  await requirePermission('plans:write');
  const before = await db.query.planPrices.findFirst({ where: eq(planPrices.id, input.priceId) });
  if (!before) throw new Error('Price not found');
  await db
    .update(planPrices)
    .set({
      unitAmount: input.unitAmount,
      isActive: input.isActive ?? before.isActive,
      updatedAt: new Date(),
    })
    .where(eq(planPrices.id, input.priceId));
  await audit({
    action: 'price.update',
    resourceType: 'price',
    resourceId: input.priceId,
    before: { unitAmount: before.unitAmount, isActive: before.isActive },
    after: { unitAmount: input.unitAmount, isActive: input.isActive },
  });
  revalidatePath('/admin/plans');
}

export async function adminSyncAllPlansAction() {
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

export async function adminSyncPlanAction(planId: string) {
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

// ───────────────────────────── Subscriptions ──────────────────────────────

export async function listAdminSubscriptions(input: {
  search?: string;
  status?: string;
  tier?: string;
  limit?: number;
  offset?: number;
}) {
  await requirePermission('billing:read');
  const limit = Math.min(100, Math.max(10, input.limit ?? 25));
  const offset = Math.max(0, input.offset ?? 0);

  const conditions = [];
  if (input.search?.trim()) {
    conditions.push(ilike(users.email, `%${input.search.trim()}%`));
  }
  if (input.status && input.status !== 'all') {
    conditions.push(
      eq(
        subscriptions.status,
        input.status as
          | 'active'
          | 'trialing'
          | 'past_due'
          | 'canceled'
          | 'incomplete'
          | 'incomplete_expired'
          | 'unpaid'
          | 'paused',
      ),
    );
  }
  if (input.tier && input.tier !== 'all') {
    conditions.push(eq(subscriptions.tier, input.tier as 'free' | 'pro' | 'teams'));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      userId: subscriptions.userId,
      email: users.email,
      name: users.name,
      tier: subscriptions.tier,
      status: subscriptions.status,
      currency: subscriptions.currency,
      interval: subscriptions.interval,
      stripePriceId: subscriptions.stripePriceId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      trialEndsAt: subscriptions.trialEndsAt,
      compReason: subscriptions.compReason,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId));

  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit)
    .offset(offset);

  const totalRow = whereClause
    ? await db
        .select({ value: count() })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .where(whereClause)
    : await db.select({ value: count() }).from(subscriptions);

  return { rows, total: totalRow[0]?.value ?? 0 };
}

export async function compSubscription(input: {
  userId: string;
  planSlug: 'pro' | 'teams';
  reason: string;
  durationDays?: number;
}) {
  await requirePermission('billing:comp');
  const plan = await db.query.plans.findFirst({ where: eq(plans.slug, input.planSlug) });
  if (!plan) throw new Error('Plan not found');
  const now = new Date();
  const periodEnd = input.durationDays
    ? new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000)
    : null;

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, input.userId),
  });

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        planId: plan.id,
        tier: input.planSlug,
        status: 'active',
        compReason: input.reason,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, input.userId));
  } else {
    await db.insert(subscriptions).values({
      userId: input.userId,
      planId: plan.id,
      tier: input.planSlug,
      status: 'active',
      compReason: input.reason,
      currentPeriodEnd: periodEnd,
    });
  }
  await audit({
    action: 'subscription.comp',
    resourceType: 'subscription',
    resourceId: input.userId,
    metadata: { plan: input.planSlug, reason: input.reason, durationDays: input.durationDays },
  });
  revalidatePath('/admin/subscriptions');
}

export async function refundLatestPayment(input: { userId: string; reason: string }) {
  await requirePermission('billing:refund');
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, input.userId),
  });
  if (!sub?.stripeCustomerId) throw new Error('No Stripe customer');

  const charges = await stripe.charges.list({
    customer: sub.stripeCustomerId,
    limit: 1,
  });
  const latest = charges.data[0];
  if (!latest) throw new Error('No charge found');
  if (!latest.paid || latest.refunded) throw new Error('Charge already refunded or not captured');

  await stripe.refunds.create({
    charge: latest.id,
    reason: 'requested_by_customer',
    metadata: { adminReason: input.reason },
  });
  await audit({
    action: 'subscription.refund',
    resourceType: 'subscription',
    resourceId: input.userId,
    metadata: { chargeId: latest.id, amount: latest.amount, reason: input.reason },
  });
  revalidatePath('/admin/subscriptions');
}

// ───────────────────────────── Audit log ──────────────────────────────

export async function listAuditLog(input: {
  search?: string;
  action?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}) {
  await requirePermission('platform:audit_log');
  const limit = Math.min(100, Math.max(10, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);

  const conditions = [];
  if (input.action?.trim()) conditions.push(ilike(auditLog.action, `%${input.action.trim()}%`));
  if (input.resourceType?.trim())
    conditions.push(eq(auditLog.resourceType, input.resourceType.trim()));

  const baseQuery = db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorEmail: users.email,
      actorName: users.name,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      before: auditLog.before,
      after: auditLog.after,
      metadata: auditLog.metadata,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

// ───────────────────────────── Feature flags ──────────────────────────────

export async function listFeatureFlags() {
  await requirePermission('platform:feature_flags');
  return db.query.featureFlags.findMany({
    orderBy: (f, { asc }) => [asc(f.key)],
  });
}

export async function upsertFeatureFlag(input: {
  key: string;
  description?: string;
  defaultEnabled: boolean;
}) {
  await requirePermission('platform:feature_flags');
  const before = await db.query.featureFlags.findFirst({ where: eq(featureFlags.key, input.key) });
  await db
    .insert(featureFlags)
    .values({
      key: input.key,
      description: input.description,
      defaultEnabled: input.defaultEnabled,
    })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: {
        description: input.description,
        defaultEnabled: input.defaultEnabled,
        updatedAt: new Date(),
      },
    });
  await audit({
    action: 'feature_flag.upsert',
    resourceType: 'feature_flag',
    resourceId: input.key,
    before: before as unknown as Record<string, unknown>,
    after: input as unknown as Record<string, unknown>,
  });
  revalidatePath('/admin/feature-flags');
}

export async function deleteFeatureFlag(key: string) {
  await requirePermission('platform:feature_flags');
  await db.delete(userFeatureFlags).where(eq(userFeatureFlags.key, key));
  await db.delete(featureFlags).where(eq(featureFlags.key, key));
  await audit({
    action: 'feature_flag.delete',
    resourceType: 'feature_flag',
    resourceId: key,
  });
  revalidatePath('/admin/feature-flags');
}

// ───────────────────────────── Broadcasts ──────────────────────────────

export async function listBroadcasts() {
  await requirePermission('platform:broadcasts');
  return db.query.broadcasts.findMany({
    orderBy: (b, { desc }) => [desc(b.createdAt)],
    limit: 100,
  });
}

export async function createBroadcast(input: {
  title: string;
  body: string;
  segment?: Record<string, unknown>;
  scheduledFor?: Date | null;
}) {
  await requirePermission('platform:broadcasts');
  const me = await getViewer();
  await db.insert(broadcasts).values({
    title: input.title,
    body: input.body,
    segment: (input.segment ?? {}) as never,
    status: input.scheduledFor ? 'queued' : 'draft',
    scheduledFor: input.scheduledFor ?? null,
    createdBy: me?.id ?? null,
  });
  await audit({
    action: 'broadcast.create',
    resourceType: 'broadcast',
    metadata: { title: input.title, scheduledFor: input.scheduledFor?.toISOString() ?? null },
  });
  revalidatePath('/admin/broadcasts');
}

export async function deleteBroadcast(id: string) {
  await requirePermission('platform:broadcasts');
  await db.delete(broadcasts).where(eq(broadcasts.id, id));
  await audit({
    action: 'broadcast.delete',
    resourceType: 'broadcast',
    resourceId: id,
  });
  revalidatePath('/admin/broadcasts');
}

// ───────────────────────────── Coupons ──────────────────────────────

export async function listCoupons() {
  await requirePermission('platform:coupons');
  const stripe = getStripe();
  if (!stripe) return [];
  const list = await stripe.coupons.list({ limit: 100 });
  return list.data.map((c) => ({
    id: c.id,
    name: c.name ?? c.id,
    percentOff: c.percent_off,
    amountOff: c.amount_off,
    currency: c.currency,
    duration: c.duration,
    durationInMonths: c.duration_in_months,
    valid: c.valid,
    redeemBy: c.redeem_by ? new Date(c.redeem_by * 1000) : null,
    timesRedeemed: c.times_redeemed,
    maxRedemptions: c.max_redemptions,
  }));
}

export async function createCoupon(input: {
  name: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: 'once' | 'forever' | 'repeating';
  durationInMonths?: number;
  maxRedemptions?: number;
}) {
  await requirePermission('platform:coupons');
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  const created = await stripe.coupons.create({
    name: input.name,
    percent_off: input.percentOff,
    amount_off: input.amountOff,
    currency: input.currency,
    duration: input.duration,
    duration_in_months: input.durationInMonths,
    max_redemptions: input.maxRedemptions,
  });
  await audit({
    action: 'coupon.create',
    resourceType: 'coupon',
    resourceId: created.id,
    metadata: input as unknown as Record<string, unknown>,
  });
  revalidatePath('/admin/coupons');
  return created.id;
}

export async function deleteCoupon(id: string) {
  await requirePermission('platform:coupons');
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  await stripe.coupons.del(id);
  await audit({
    action: 'coupon.delete',
    resourceType: 'coupon',
    resourceId: id,
  });
  revalidatePath('/admin/coupons');
}

// ───────────────────────────── Health ──────────────────────────────

export async function getSystemHealth() {
  await requirePermission('platform:health');
  const t0 = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - start;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  let stripeOk = false;
  let stripeLatencyMs = 0;
  const stripe = getStripe();
  if (stripe) {
    try {
      const start = Date.now();
      await stripe.balance.retrieve();
      stripeLatencyMs = Date.now() - start;
      stripeOk = true;
    } catch {
      stripeOk = false;
    }
  }

  return {
    serverAt: new Date(),
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    stripe: { ok: stripeOk, configured: stripe !== null, latencyMs: stripeLatencyMs },
    totalMs: Date.now() - t0,
  };
}
