import { pgTable, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Public template gallery. Templates are seed content (title, plaintext,
 * optional Y.Doc snapshot) that "Apply" copies into a new note.
 */
export const templates = pgTable(
  'templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('general'),
    icon: text('icon'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    body: jsonb('body')
      .$type<{
        kind: 'note' | 'sticky';
        icon?: string | null;
        color?: string | null;
        plaintext: string;
        blocks?: Array<{ type: string; content?: string; level?: number }>;
      }>()
      .notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    isOfficial: boolean('is_official').notNull().default(false),
    isPublished: boolean('is_published').notNull().default(true),
    uses: integer('uses').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('templates_published_category_idx').on(t.isPublished, t.category)],
);

export type Template = typeof templates.$inferSelect;
