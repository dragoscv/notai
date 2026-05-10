import { pgTable, text, timestamp, uniqueIndex, index, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { folders } from './notes';

/**
 * Workspaces \u2014 multi-user team spaces. A workspace owns members; a
 * shared folder lives in a workspace and is visible to every member at
 * (or above) the access level encoded by its `role`.
 *
 * Migration `0017_workspaces` creates the tables.
 */

export const workspaceRole = pgEnum('workspace_role', ['owner', 'admin', 'editor', 'viewer']);

export const workspaces = pgTable('workspaces', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull().default('editor'),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('workspace_members_unq').on(t.workspaceId, t.userId),
    index('workspace_members_user_idx').on(t.userId),
  ],
);

/**
 * Folders that are shared into a workspace. The folder still belongs
 * to its original owner; this table grants the workspace read/write
 * access at the folder level. Notes inside the folder inherit access.
 */
export const sharedFolders = pgTable(
  'shared_folders',
  {
    folderId: text('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull().default('editor'),
    sharedAt: timestamp('shared_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shared_folders_unq').on(t.folderId, t.workspaceId),
    index('shared_folders_workspace_idx').on(t.workspaceId),
  ],
);

/** Pending invitations by email (resolved on first sign-in). */
export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: workspaceRole('role').notNull().default('editor'),
    invitedById: text('invited_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('workspace_invites_ws_email_unq').on(t.workspaceId, t.email)],
);
