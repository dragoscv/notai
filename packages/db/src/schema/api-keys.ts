import { pgTable, text, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Developer API keys for the public REST API. The raw key is shown
 * once at creation and never persisted; we store SHA-256 + a short
 * prefix for display & lookup. Scopes is a space-separated list
 * (e.g. "notes:read notes:write tasks:write").
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    prefix: varchar('prefix', { length: 12 }).notNull(),
    hashedKey: text('hashed_key').notNull(),
    scopes: text('scopes').notNull().default('notes:read notes:write'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('api_keys_user_idx').on(t.userId), uniqueIndex('api_keys_prefix_unq').on(t.prefix)],
);

/**
 * Web Push (PushManager) subscriptions for daily review reminders
 * and other notifications. Each browser session creates one row.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_unq').on(t.endpoint),
    index('push_subscriptions_user_idx').on(t.userId),
  ],
);
