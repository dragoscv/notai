import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * One row per user — only present when TOTP enrollment has started.
 * `enabled = false` means enrollment is in flight (secret generated but
 * not yet confirmed by a valid code). When `enabled = true`, recovery
 * codes have been issued and the user can complete step-up auth.
 */
export const userTotp = pgTable('user_totp', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  /** Updated on a successful TOTP/recovery verification — used for step-up freshness. */
  lastStepUpAt: timestamp('last_step_up_at', { withTimezone: true }),
  /** Array of `sha256:<hex>` strings; one entry per remaining code. */
  recoveryCodesHashed: jsonb('recovery_codes_hashed').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
