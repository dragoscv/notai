import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Per-user secrets for "bring your own keys" AI providers.
 *
 * `ciphertext` is base64(iv || authTag || encrypted bytes) using AES-256-GCM.
 * The encryption key is derived from AUTH_SECRET via HKDF-SHA256 so users
 * don't need a separate env var, but you can override with
 * SECRETS_ENCRYPTION_KEY (32-byte base64) for rotation.
 *
 * `meta` is non-sensitive metadata (key prefix for display, github login,
 * cached short-lived session token + expiry, etc.) — never the raw secret.
 */
export const userSecrets = pgTable(
  'user_secrets',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'openai' | 'copilot' | 'anthropic' (extensible) */
    provider: text('provider').notNull(),
    ciphertext: text('ciphertext').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    uniq: unique('user_secrets_user_provider_uniq').on(t.userId, t.provider),
    byUser: index('user_secrets_user_idx').on(t.userId),
  }),
);

export type UserSecret = typeof userSecrets.$inferSelect;

/**
 * Per-user AI feature → provider+model preferences.
 * NULL columns mean "use server default" (env-configured).
 */
export const userAiPrefs = pgTable('user_ai_prefs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  chatProvider: text('chat_provider'),
  chatModel: text('chat_model'),

  embedProvider: text('embed_provider'),
  embedModel: text('embed_model'),

  transcribeProvider: text('transcribe_provider'),
  transcribeModel: text('transcribe_model'),

  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserAiPrefs = typeof userAiPrefs.$inferSelect;
