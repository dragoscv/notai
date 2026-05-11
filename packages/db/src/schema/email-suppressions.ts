import { pgTable, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';

export const emailSuppressionReason = pgEnum('email_suppression_reason', [
  'bounce',
  'complaint',
  'manual',
  'delivery_delayed',
]);

/**
 * Suppression list — addresses we must not send to. Populated from
 * provider webhooks (Resend bounce/complaint events) and the manual
 * unsubscribe action. `sendEmail()` short-circuits when the recipient
 * appears here.
 *
 * Email is the primary key (lowercased) so duplicate events are idempotent.
 */
export const emailSuppressions = pgTable(
  'email_suppressions',
  {
    email: text('email').primaryKey(),
    reason: emailSuppressionReason('reason').notNull(),
    source: text('source'),
    detail: text('detail'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_suppressions_reason_idx').on(t.reason, t.createdAt)],
);

export type EmailSuppression = typeof emailSuppressions.$inferSelect;
