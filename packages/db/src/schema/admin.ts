import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Audit log: every privileged admin action is recorded with actor +
 * before/after JSON snapshots so changes are diffable. Append-only — no
 * deletes from app code (cron may purge >12 months).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    /** e.g. 'user', 'subscription', 'plan', 'price', 'role'. */
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorId, t.createdAt),
    index('audit_log_resource_idx').on(t.resourceType, t.resourceId),
    index('audit_log_created_idx').on(t.createdAt),
  ],
);

/**
 * Feature flags. Default is in `defaultEnabled`; per-user overrides go
 * into `userFeatureFlags`. Admin UI manages both.
 */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  description: text('description'),
  defaultEnabled: boolean('default_enabled').notNull().default(false),
  /** Optional rollout percentage (0–100); evaluated client-side via stable hash. */
  rolloutPercent: jsonb('rollout_percent')
    .$type<number | null>()
    .default(null as never),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userFeatureFlags = pgTable(
  'user_feature_flags',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key')
      .notNull()
      .references(() => featureFlags.key, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull(),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_feature_flags_pk').on(t.userId, t.key)],
);

/**
 * Email broadcasts queued by the admin. Workers pick up rows where
 * `status = 'queued'` and the optional `scheduledFor` is past.
 */
export const broadcastStatus = pgEnum('broadcast_status', [
  'draft',
  'queued',
  'sending',
  'sent',
  'failed',
]);

export const broadcasts = pgTable(
  'broadcasts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    /** Markdown body rendered into the email template. */
    body: text('body').notNull(),
    /**
     * Audience selector. Examples: { plan: 'pro' }, { plan: 'free', signedUpAfter: '...' }.
     */
    segment: jsonb('segment')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({} as never),
    status: broadcastStatus('status').notNull().default('draft'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('broadcasts_status_idx').on(t.status, t.scheduledFor)],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
