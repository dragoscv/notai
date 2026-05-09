import { pgTable, text, timestamp, primaryKey, boolean } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * RBAC: roles + permissions + many-to-many user_roles / role_permissions.
 *
 * Permissions use a `resource:action` convention (e.g. `users:read`,
 * `billing:refund`) stored as a free-form text key. The seed script
 * populates the canonical set; the admin UI can extend it later.
 */
export const roles = pgTable('roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  /** System roles cannot be renamed or deleted from the admin UI. */
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** e.g. `users:read`, `billing:refund`. */
  key: text('key').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    grantedBy: text('granted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
