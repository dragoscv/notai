'use server';

/**
 * Bootstraps a freshly-created user with:
 *   - the `user` role (always)
 *   - the `super_admin` role (only if their email matches SUPER_ADMIN_EMAIL)
 *   - a free-tier subscription row
 *
 * Idempotent: every insert uses ON CONFLICT DO NOTHING. Called from
 * Auth.js `events.createUser` and also by the platform seed for backfill.
 */

import {
  db,
  eq,
  users,
  roles,
  userRoles,
  plans,
  subscriptions,
  SUPER_ADMIN_EMAIL,
} from '@notai/db';

export async function bootstrapNewUser(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;

  const userRole = await db.query.roles.findFirst({ where: eq(roles.name, 'user') });
  if (userRole) {
    await db.insert(userRoles).values({ userId, roleId: userRole.id }).onConflictDoNothing();
  }

  if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    const superAdmin = await db.query.roles.findFirst({
      where: eq(roles.name, 'super_admin'),
    });
    if (superAdmin) {
      await db.insert(userRoles).values({ userId, roleId: superAdmin.id }).onConflictDoNothing();
    }
  }

  const freePlan = await db.query.plans.findFirst({ where: eq(plans.slug, 'free') });
  if (freePlan) {
    await db
      .insert(subscriptions)
      .values({
        userId,
        planId: freePlan.id,
        tier: 'free',
        status: 'active',
      })
      .onConflictDoNothing();
  }
}
