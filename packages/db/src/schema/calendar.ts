import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Calendar subscriptions — users paste a public iCal/webcal URL and we
 * fetch + parse it on demand to surface "today on your calendar"
 * context inside the dashboard / daily note. Read-only by design;
 * write-back to the calendar source is out of scope.
 */
export const calendarSubscriptions = pgTable(
  'calendar_subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    color: text('color'),
    enabled: boolean('enabled').notNull().default(true),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('calendar_subs_user_idx').on(t.userId)],
);
