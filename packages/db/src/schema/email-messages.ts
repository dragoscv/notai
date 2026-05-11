import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { notes } from './notes';

/**
 * Inbound email message ledger — records the RFC-5322 `Message-ID` of
 * each delivered inbound email and the note it landed on. Used to
 * thread replies: when an inbound email's `In-Reply-To` (or first
 * `References` entry) matches a row here, the new email's body is
 * appended to that note instead of creating a fresh note.
 */
export const emailMessages = pgTable(
  'email_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Normalised Message-ID — angle brackets stripped, lower-cased. */
    messageId: text('message_id').notNull(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_messages_message_id_unq').on(t.messageId),
    index('email_messages_note_idx').on(t.noteId),
  ],
);

export type EmailMessage = typeof emailMessages.$inferSelect;
