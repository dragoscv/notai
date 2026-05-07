import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  integer,
  customType,
  pgEnum,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

// Yjs documents are binary blobs — use bytea
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

export const noteKind = pgEnum('note_kind', ['note', 'sticky']);
export const role = pgEnum('collab_role', ['owner', 'editor', 'viewer']);

/**
 * Folders — optional, user-defined hierarchy for organising notes.
 *
 * Folders are ordered per-parent via `position` (stable float with large gaps
 * so reordering doesn't rewrite every sibling). A null `parentId` means a
 * top-level folder in the sidebar root.
 */
export const folders = pgTable(
  'folders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull().default('New folder'),
    icon: text('icon'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('folders_owner_parent_idx').on(t.ownerId, t.parentId, t.position)],
);

/**
 * Notes — the core document. Content lives in a Yjs doc (binary),
 * plus a plaintext mirror for search. Drawing strokes + rich text are
 * both inside the same Y.Doc so realtime is unified.
 */
export const notes = pgTable(
  'notes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    title: text('title').notNull().default('Untitled'),
    icon: text('icon'), // emoji or lucide icon name
    color: text('color').default('default'), // theme accent for sticky mode
    kind: noteKind('kind').notNull().default('note'),

    /**
     * Optional parent folder. When null the note lives at the sidebar
     * root. `onDelete: 'set null'` keeps notes alive when their folder
     * is deleted (same behaviour as most file managers).
     */
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    /** Ordering within the folder (or root). See `folders.position` for rationale. */
    position: integer('position').notNull().default(0),

    // Plaintext mirror of the editor content for FTS
    plaintext: text('plaintext').notNull().default(''),

    // Serialized Y.Doc state (Y.encodeStateAsUpdate). Hocuspocus owns writes here.
    yjsState: bytea('yjs_state'),

    // Sticky-note window state (position/size on desktop)
    stickyState: jsonb('sticky_state').$type<{
      x: number;
      y: number;
      w: number;
      h: number;
      alwaysOnTop: boolean;
    } | null>(),

    isPinned: boolean('is_pinned').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    isFavorite: boolean('is_favorite').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  },
  (t) => [
    index('notes_owner_updated_idx').on(t.ownerId, t.updatedAt.desc()),
    index('notes_owner_pinned_idx').on(t.ownerId, t.isPinned, t.updatedAt.desc()),
    index('notes_owner_folder_pos_idx').on(t.ownerId, t.folderId, t.position),
    index('notes_plaintext_trgm_idx').using('gin', sql`${t.plaintext} gin_trgm_ops`),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_owner_name_unq').on(t.ownerId, t.name)],
);

export const noteTags = pgTable(
  'note_tags',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('note_tags_unq').on(t.noteId, t.tagId)],
);

/**
 * Collaborators — realtime sharing. The owner is implicit.
 */
export const noteCollaborators = pgTable(
  'note_collaborators',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: role('role').notNull().default('editor'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('note_collab_unq').on(t.noteId, t.userId)],
);

/**
 * Assets — uploaded images / drawings that live outside the Y.Doc
 * (e.g. raster exports of S Pen strokes, pasted images).
 */
export const assets = pgTable(
  'assets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assets_note_idx').on(t.noteId)],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  notes: many(notes),
  tags: many(tags),
  collabs: many(noteCollaborators),
  folders: many(folders),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  owner: one(users, { fields: [notes.ownerId], references: [users.id] }),
  folder: one(folders, { fields: [notes.folderId], references: [folders.id] }),
  tags: many(noteTags),
  collaborators: many(noteCollaborators),
  assets: many(assets),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  owner: one(users, { fields: [folders.ownerId], references: [users.id] }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folder_parent',
  }),
  children: many(folders, { relationName: 'folder_parent' }),
  notes: many(notes),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  owner: one(users, { fields: [tags.ownerId], references: [users.id] }),
  notes: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, { fields: [noteTags.noteId], references: [notes.id] }),
  tag: one(tags, { fields: [noteTags.tagId], references: [tags.id] }),
}));

export const noteCollaboratorsRelations = relations(noteCollaborators, ({ one }) => ({
  note: one(notes, { fields: [noteCollaborators.noteId], references: [notes.id] }),
  user: one(users, { fields: [noteCollaborators.userId], references: [users.id] }),
}));

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NoteCollaborator = typeof noteCollaborators.$inferSelect;
export type Folder = typeof folders.$inferSelect;
