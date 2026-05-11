import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { notes } from './notes';

/**
 * Per-user receipts of E2E lifecycle events: encryption set up,
 * passphrase rotated, note locked / unlocked / disabled, idle relock.
 * Persisted so users can audit their own privacy posture from
 * Settings → Security. Note IDs are nullable so account-scoped events
 * (e.g. "encryption enabled") still get rows after notes are deleted.
 */
export const e2eAuditLog = pgTable(
  'e2e_audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: text('note_id').references(() => notes.id, { onDelete: 'set null' }),
    /** One of: setup, rotate, note_lock, note_unlock, note_disable, recovery_unlock. */
    event: text('event').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('e2e_audit_log_user_created_idx').on(t.userId, t.createdAt.desc())],
);
