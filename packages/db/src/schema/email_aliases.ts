import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Inbound email aliases. Each user has one token; the inbound address
 * looks like `user+TOKEN@in.notai.app`. The token is a 12+ char,
 * URL-safe random string (NOT predictable from user id) so anyone who
 * doesn't know it can't deliver mail into the user's notes.
 */
export const emailAliases = pgTable(
  'email_aliases',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  },
  (t) => [index('email_aliases_token_idx').on(t.token)],
);
