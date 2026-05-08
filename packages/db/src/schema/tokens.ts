import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Personal Access Tokens for the web clipper extension and other
 * non-browser clients. We hash the secret at rest (sha256) and only show
 * the raw value once at creation time.
 */
export const personalAccessTokens = pgTable(
  'personal_access_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    scope: text('scope').notNull().default('clipper'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    byUser: index('pat_user_idx').on(t.userId),
  }),
);

export type PersonalAccessToken = typeof personalAccessTokens.$inferSelect;
