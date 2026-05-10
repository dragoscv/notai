import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { notes } from './notes';

/**
 * Notion/Bear-style structured properties on a note. One row = one
 * key/value. Exactly one of the typed value columns is populated per
 * row (DB CHECK constraint enforces this in the migration).
 */
export const notePropertyValueType = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
  'url',
] as const;
export type NotePropertyValueType = (typeof notePropertyValueType)[number];

export const noteProperties = pgTable(
  'note_properties',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    valueType: text('value_type').$type<NotePropertyValueType>().notNull(),
    valueText: text('value_text'),
    valueNumber: numeric('value_number'),
    valueDate: timestamp('value_date', { withTimezone: true }),
    valueBool: boolean('value_bool'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('note_properties_note_idx').on(t.noteId),
    index('note_properties_owner_key_idx').on(t.ownerId, t.key),
    uniqueIndex('note_properties_note_key_uq').on(t.noteId, t.key),
  ],
);
