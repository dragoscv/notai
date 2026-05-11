import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Per-user E2E key vault. The master key is generated client-side
 * (32 random bytes, AES-GCM 256) and never leaves the browser in
 * plaintext. We store it twice:
 *
 *   * `encryptedMasterKey` — wrapped by a KEK derived from the user's
 *     passphrase via PBKDF2 (`kdfIters` iterations, SHA-256, per-user
 *     `salt`). The day-to-day unlock path.
 *
 *   * `encryptedMasterKeyByRecovery` — wrapped by a 32-byte random
 *     recovery key displayed once at setup. The user is responsible
 *     for storing it offline; we cannot recover it.
 *
 * Both wrapping operations are AES-GCM with the IV prepended to the
 * ciphertext. If the user loses BOTH the passphrase AND the recovery
 * key, encrypted notes are permanently unreadable — by design.
 */
export const userKeys = pgTable('user_keys', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  salt: text('salt').notNull(),
  encryptedMasterKey: text('encrypted_master_key').notNull(),
  encryptedMasterKeyByRecovery: text('encrypted_master_key_by_recovery').notNull(),
  kdfIters: integer('kdf_iters').notNull().default(600_000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
});
