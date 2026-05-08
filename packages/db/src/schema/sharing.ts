import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { notes, role } from './notes';

/**
 * Pending share invitations sent by email. Lets the owner invite someone
 * who hasn't signed up yet — when that user signs in we move the row
 * into `note_collaborators` (or do it on accept-link).
 */
export const noteInvites = pgTable(
  'note_invites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: role('role').notNull().default('editor'),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('note_invites_token_unq').on(t.tokenHash),
    index('note_invites_note_idx').on(t.noteId),
    index('note_invites_email_idx').on(t.email),
  ],
);

export type NoteInvite = typeof noteInvites.$inferSelect;
