import { pgTable, text, timestamp, boolean, integer, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Outgoing webhook subscription. Each user can register URLs that
 * receive a POSTed JSON envelope when one of their notes changes.
 * Payloads are signed with HMAC-SHA256 of the body using `secret`,
 * delivered as `X-Notai-Signature: sha256=<hex>`.
 */
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: text('events').notNull().default('note.created note.updated note.archived'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    failureCount: integer('failure_count').notNull().default(0),
  },
  (t) => [index('webhook_endpoints_user_idx').on(t.userId)],
);

/**
 * Per-attempt delivery log. Lets the user inspect why a webhook
 * isn't firing in the dashboard. Capped to last N rows by a cron.
 */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer('duration_ms'),
  },
  (t) => [index('webhook_deliveries_endpoint_idx').on(t.endpointId, t.deliveredAt)],
);
