import { pgTable, text, timestamp, integer, doublePrecision, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { workspaces } from './workspaces';
import { notes } from './notes';

export const flashcards = pgTable(
  'flashcards',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    noteId: text('note_id').references(() => notes.id, { onDelete: 'set null' }),
    front: text('front').notNull(),
    back: text('back').notNull(),
    easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    repetitions: integer('repetitions').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('flashcards_user_due_idx').on(t.userId, t.dueAt),
    index('flashcards_note_idx').on(t.noteId),
  ],
);

export const flashcardReviews = pgTable(
  'flashcard_reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    flashcardId: text('flashcard_id')
      .notNull()
      .references(() => flashcards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    quality: integer('quality').notNull(),
    prevInterval: integer('prev_interval').notNull(),
    nextInterval: integer('next_interval').notNull(),
    easeFactorAfter: doublePrecision('ease_factor_after').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('flashcard_reviews_card_idx').on(t.flashcardId, t.reviewedAt)],
);

export type Flashcard = typeof flashcards.$inferSelect;
export type FlashcardReview = typeof flashcardReviews.$inferSelect;
