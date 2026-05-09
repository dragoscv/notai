import { pgTable, text, timestamp, index, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const supportTicketStatus = pgEnum('support_ticket_status', [
  'open',
  'pending',
  'resolved',
  'closed',
]);

export const supportTicketPriority = pgEnum('support_ticket_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const supportTicketCategory = pgEnum('support_ticket_category', [
  'general',
  'billing',
  'bug',
  'feature_request',
  'account',
  'gdpr',
  'other',
]);

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Short human-friendly reference shown to user (e.g. NT-2026-0001). */
    reference: text('reference').notNull(),
    /** May be null if submitted from public contact form (then email is the only contact). */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Always required — used as reply-to even for signed-in users. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    category: supportTicketCategory('category').notNull().default('general'),
    priority: supportTicketPriority('priority').notNull().default('normal'),
    status: supportTicketStatus('status').notNull().default('open'),
    /** Set by admin when assigned. */
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('support_tickets_user_idx').on(t.userId, t.createdAt),
    index('support_tickets_status_idx').on(t.status, t.updatedAt),
    index('support_tickets_reference_idx').on(t.reference),
  ],
);

export const supportTicketMessages = pgTable(
  'support_ticket_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    /** Null for system messages (status change notes). */
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    /** True when message comes from a staff/admin reply (visible to user). */
    fromStaff: boolean('from_staff').notNull().default(false),
    /** Internal-only note not shown to the requester. */
    internal: boolean('internal').notNull().default(false),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_ticket_messages_ticket_idx').on(t.ticketId, t.createdAt)],
);
