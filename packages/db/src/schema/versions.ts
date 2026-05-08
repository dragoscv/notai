import { pgTable, text, timestamp, integer, customType, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { notes } from './notes';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return new Uint8Array(value as Buffer);
  },
});

/**
 * Snapshot of a note's Y.Doc at a point in time. Realtime server writes
 * one of these every N edits or every M minutes (whichever first).
 */
export const noteVersions = pgTable(
  'note_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    plaintext: text('plaintext').notNull().default(''),
    yjsState: bytea('yjs_state').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('note_versions_note_idx').on(t.noteId, t.createdAt)],
);

export type NoteVersion = typeof noteVersions.$inferSelect;
