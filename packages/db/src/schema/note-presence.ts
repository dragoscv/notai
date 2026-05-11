import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { notes } from './notes';

/**
 * Coarse "user is currently looking at this note" presence rows.
 * Each open note workspace heartbeats once every 30s and the graph
 * view treats rows with `last_seen_at > now() - 60s` as live.
 * Older rows are reaped opportunistically when the next heartbeat
 * runs (no separate cron required).
 */
export const notePresence = pgTable(
  'note_presence',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('note_presence_user_note_uq').on(t.userId, t.noteId),
    index('note_presence_last_seen_idx').on(t.lastSeenAt),
  ],
);
