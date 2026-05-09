import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import {
  db,
  and,
  eq,
  inArray,
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  type PermissionKey,
  type RoleName,
} from '@notai/db';
import { auth } from '@/auth';

/**
 * Returns the current viewer (Auth.js session). Cached per-request via
 * React `cache()` so multiple gates in the same render don't re-fetch.
 */
export const getViewer = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
});

/** Returns the role names the current viewer has. */
export const getViewerRoles = cache(async (): Promise<RoleName[]> => {
  const viewer = await getViewer();
  if (!viewer?.id) return [];
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, viewer.id));
  return rows.map((r) => r.name as RoleName);
});

/** Returns the permission keys the current viewer has, deduped. */
export const getViewerPermissions = cache(async (): Promise<Set<PermissionKey>> => {
  const viewer = await getViewer();
  if (!viewer?.id) return new Set();
  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, viewer.id));
  return new Set(rows.map((r) => r.key as PermissionKey));
});

export async function hasPermission(perm: PermissionKey): Promise<boolean> {
  const perms = await getViewerPermissions();
  return perms.has(perm);
}

export async function hasAnyPermission(perms: PermissionKey[]): Promise<boolean> {
  const owned = await getViewerPermissions();
  return perms.some((p) => owned.has(p));
}

export async function hasRole(role: RoleName): Promise<boolean> {
  const owned = await getViewerRoles();
  return owned.includes(role);
}

export async function isAdmin(): Promise<boolean> {
  const owned = await getViewerRoles();
  return owned.some((r) => r === 'super_admin' || r === 'admin' || r === 'support');
}

/**
 * Server-action / page guard. Redirects to /signin when signed out, to
 * `/` when signed in but lacking the permission. Use at the top of any
 * server action / RSC page that needs the permission.
 */
export async function requirePermission(perm: PermissionKey): Promise<void> {
  const viewer = await getViewer();
  if (!viewer?.id) redirect('/signin');
  if (!(await hasPermission(perm))) redirect('/');
}

export async function requireAdmin(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer?.id) redirect('/signin');
  if (!(await isAdmin())) redirect('/');
}

/**
 * Look up the roles + permissions of an arbitrary user (admin tooling).
 * Not cached — usually called once per admin page load with a different id.
 */
export async function getUserRolesAndPermissions(userId: string): Promise<{
  roles: RoleName[];
  permissions: PermissionKey[];
}> {
  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  const userRoleNames = roleRows.map((r) => r.name as RoleName);

  if (userRoleNames.length === 0) {
    return { roles: [], permissions: [] };
  }

  const permRows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));
  const dedup = Array.from(new Set(permRows.map((r) => r.key as PermissionKey)));
  return { roles: userRoleNames, permissions: dedup };
}

/**
 * Grant or revoke a role on a user. Caller must already be authorized
 * (`users:assign_roles`). Throws if the role doesn't exist.
 */
export async function grantRole(
  userId: string,
  roleName: RoleName,
  grantedBy: string,
): Promise<void> {
  const role = await db.query.roles.findFirst({ where: eq(roles.name, roleName) });
  if (!role) throw new Error(`role not found: ${roleName}`);
  await db.insert(userRoles).values({ userId, roleId: role.id, grantedBy }).onConflictDoNothing();
}

export async function revokeRole(userId: string, roleName: RoleName): Promise<void> {
  const role = await db.query.roles.findFirst({ where: eq(roles.name, roleName) });
  if (!role) throw new Error(`role not found: ${roleName}`);
  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));
}

/** Convenience: fetch the user row for the current viewer (or null). */
export async function getViewerRecord() {
  const viewer = await getViewer();
  if (!viewer?.id) return null;
  return (await db.query.users.findFirst({ where: eq(users.id, viewer.id) })) ?? null;
}

/** For batch lookups e.g. admin user list. */
export async function getRolesForUsers(userIds: string[]): Promise<Map<string, RoleName[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userRoles.userId, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(inArray(userRoles.userId, userIds));
  const map = new Map<string, RoleName[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.name as RoleName);
    map.set(row.userId, list);
  }
  return map;
}
