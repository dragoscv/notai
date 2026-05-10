import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Saved views — per-user UI presets for sort + filter on a given page
 * scope (currently only `'dashboard'`). Each user can save up to ~20
 * named views; one is marked default and shown when the page loads
 * without an explicit selection.
 */
export const userViews = pgTable(
  'user_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Page scope this view applies to. Currently only `'dashboard'`. */
    scope: text('scope').notNull(),
    name: text('name').notNull(),
    /** Sort key — one of `updated|created|opened|alphabetical|custom`. */
    sort: text('sort').notNull().default('updated'),
    pinnedFirst: boolean('pinned_first').notNull().default(true),
    /** Filter spec (folders, tags, kinds, status, colors, dateRange, search). */
    filters: jsonb('filters')
      .notNull()
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb` as never),
    isDefault: boolean('is_default').notNull().default(false),
    /** Display order in the view dropdown. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_views_user_scope_name_unq').on(t.userId, t.scope, t.name),
    index('user_views_user_scope_pos_idx').on(t.userId, t.scope, t.position),
  ],
);
