/**
 * Phase 1 platform seed — idempotent.
 *
 * Run with: pnpm --filter @notai/db seed:platform
 *
 * What it does:
 *   1. Upserts every permission key.
 *   2. Upserts every system role and its role_permissions mapping
 *      (additively — never deletes a previously granted permission so
 *      a manual grant from the admin UI survives a reseed).
 *   3. Upserts the default plans + prices (admin UI can edit them later).
 *   4. Ensures the SUPER_ADMIN_EMAIL user exists and has the super_admin role.
 *   5. Ensures every existing user has at least the `user` role and a
 *      `subscriptions` row pointing at the free plan.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from './client';
import {
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  plans,
  planPrices,
  subscriptions,
} from './schema';
import { PERMISSIONS, ROLES, type RoleName, type PermissionKey } from './rbac-config';
import { DEFAULT_PLANS, SUPER_ADMIN_EMAIL } from './plans-config';

async function seedPermissions() {
  for (const [key, description] of Object.entries(PERMISSIONS) as [PermissionKey, string][]) {
    await db.insert(permissions).values({ key, description }).onConflictDoUpdate({
      target: permissions.key,
      set: { description },
    });
  }
  console.log(`  ✓ permissions: ${Object.keys(PERMISSIONS).length}`);
}

async function seedRoles() {
  for (const [name, def] of Object.entries(ROLES) as [RoleName, (typeof ROLES)[RoleName]][]) {
    await db
      .insert(roles)
      .values({ name, description: def.description, isSystem: def.isSystem })
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: def.description, isSystem: def.isSystem },
      });

    const role = await db.query.roles.findFirst({ where: eq(roles.name, name) });
    if (!role) throw new Error(`role ${name} missing after upsert`);

    for (const permKey of def.permissions as readonly PermissionKey[]) {
      const perm = await db.query.permissions.findFirst({
        where: eq(permissions.key, permKey),
      });
      if (!perm) throw new Error(`permission ${permKey} missing for role ${name}`);
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: perm.id })
        .onConflictDoNothing();
    }
  }
  console.log(`  ✓ roles: ${Object.keys(ROLES).length}`);
}

async function seedPlans() {
  for (const def of DEFAULT_PLANS) {
    await db
      .insert(plans)
      .values({
        slug: def.slug,
        displayName: def.displayName,
        description: def.description,
        features: def.features,
        limits: def.limits,
        trialDays: def.trialDays,
        sortOrder: def.sortOrder,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: plans.slug,
        set: {
          displayName: def.displayName,
          description: def.description,
          features: def.features,
          limits: def.limits,
          trialDays: def.trialDays,
          sortOrder: def.sortOrder,
          updatedAt: sql`now()`,
        },
      });

    const plan = await db.query.plans.findFirst({ where: eq(plans.slug, def.slug) });
    if (!plan) throw new Error(`plan ${def.slug} missing after upsert`);

    for (const price of def.prices) {
      await db
        .insert(planPrices)
        .values({
          planId: plan.id,
          currency: price.currency,
          interval: price.interval,
          unitAmount: price.unitAmount,
          isActive: true,
        })
        .onConflictDoNothing();
    }
  }
  console.log(`  ✓ plans: ${DEFAULT_PLANS.length}`);
}

async function ensureSuperAdmin() {
  // Upsert the super-admin user (in case they haven't signed in yet).
  await db
    .insert(users)
    .values({ email: SUPER_ADMIN_EMAIL, name: 'Super Admin' })
    .onConflictDoNothing();

  const user = await db.query.users.findFirst({ where: eq(users.email, SUPER_ADMIN_EMAIL) });
  if (!user) throw new Error('super-admin user missing after upsert');

  const role = await db.query.roles.findFirst({ where: eq(roles.name, 'super_admin') });
  if (!role) throw new Error('super_admin role missing');

  await db.insert(userRoles).values({ userId: user.id, roleId: role.id }).onConflictDoNothing();

  console.log(`  ✓ super-admin: ${SUPER_ADMIN_EMAIL}`);
}

async function backfillExistingUsers() {
  // Every existing user gets the `user` role and a free-tier subscription
  // row if they don't already have one. Cheap to run — just a couple of
  // INSERT ... ON CONFLICT statements.
  const userRole = await db.query.roles.findFirst({ where: eq(roles.name, 'user') });
  if (!userRole) throw new Error('user role missing');
  const freePlan = await db.query.plans.findFirst({ where: eq(plans.slug, 'free') });
  if (!freePlan) throw new Error('free plan missing');

  const allUsers = await db.select({ id: users.id }).from(users);
  for (const u of allUsers) {
    await db.insert(userRoles).values({ userId: u.id, roleId: userRole.id }).onConflictDoNothing();
    await db
      .insert(subscriptions)
      .values({ userId: u.id, planId: freePlan.id, tier: 'free', status: 'active' })
      .onConflictDoNothing();
  }
  console.log(`  ✓ backfilled ${allUsers.length} users with default role + free plan`);
}

async function main() {
  console.log('🌱 platform seed (Phase 1)');
  await seedPermissions();
  await seedRoles();
  await seedPlans();
  await ensureSuperAdmin();
  await backfillExistingUsers();
  console.log('✓ done');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
