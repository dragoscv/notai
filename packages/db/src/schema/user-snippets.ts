import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Per-user text snippets that expand `::name` in the canvas. Mirrors
 * the client-side store in apps/web/src/lib/snippets.ts so users get
 * cross-device sync. Names are unique per user (case-insensitive
 * canonical form already lives in the client store).
 */
export const userSnippets = pgTable(
  'user_snippets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_snippets_user_name_uq').on(t.userId, t.name)],
);
