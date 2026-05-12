import { pgTable, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Outbound lifecycle email ledger. One row per (user, kind) records that
 * the welcome / day-3 / day-7 onboarding email has been delivered, so the
 * cron job stays idempotent across runs.
 *
 * Lifecycle kinds are open-ended strings so we can add more touchpoints
 * later (re-engagement, trial-ending, etc.) without a migration.
 */
export const emailLifecycleSends = pgTable(
  'email_lifecycle_sends',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'welcome' | 'day-3-tip' | 'day-7-feedback' | future kinds. */
    kind: text('kind').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind] }),
    index('email_lifecycle_sends_kind_idx').on(t.kind),
  ],
);

export type EmailLifecycleSend = typeof emailLifecycleSends.$inferSelect;
