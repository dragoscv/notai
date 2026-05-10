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
    /**
     * Tag IDs that should be auto-attached to any note created inside
     * this folder. Empty array by default \u2014 callers explicitly opt in
     * via the folder context menu.
     */
    defaultTagIds: jsonb('default_tag_ids').$type<string[]>().notNull().default([]),
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

    /**
     * Separate from `isPinned` (which drives the global Pinned section
     * in the sidebar) — `isPinnedOnToday` only affects the dashboard
     * landing page, where users curate which notes float to the top of
     * their daily view without polluting the sidebar's pinned list.
     */
    isPinnedOnToday: boolean('is_pinned_on_today').notNull().default(false),

    /**
     * Soft delete. Set when the user moves a note to Trash; a daily cron
     * permanently purges rows where `deletedAt` is older than 30 days.
     * Notes with this set never appear in normal queries.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    /**
     * Pre-computed embedding of `plaintext` (OpenAI text-embedding-3-small,
     * 1536 dims). Stored as `vector` via pgvector. Recomputed by a worker
     * when plaintext changes.
     */
    embedding: customType<{ data: number[]; driverData: string }>({
      dataType() {
        return 'vector(1536)';
      },
      toDriver(value) {
        return `[${value.join(',')}]`;
      },
      fromDriver(value) {
        const s = value as unknown as string;
        return s
          .replace(/[\[\]]/g, '')
          .split(',')
          .map(Number);
      },
    })('embedding'),
    embeddingModel: text('embedding_model'),
    embeddingUpdatedAt: timestamp('embedding_updated_at', { withTimezone: true }),

    /**
     * Public read-only share link. Null token means "not shared".
     * `publicShareExpiresAt` is optional — null means never expires
     * (until the user manually disables the link).
     */
    publicShareToken: text('public_share_token'),
    publicShareExpiresAt: timestamp('public_share_expires_at', { withTimezone: true }),
    /** Optional human-readable slug used at `/p/<slug>` instead of the
     *  opaque token. Unique per owner via the partial index defined in
     *  migration 0016. */
    publicShareSlug: text('public_share_slug'),

    /** Scrypt hash protecting reads of this note. Null = unlocked. */
    passwordHash: text('password_hash'),
    passwordSetAt: timestamp('password_set_at', { withTimezone: true }),

    /**
     * Optional cover image for the note (Notion/Craft-style banner).
     * `coverPosition` is the vertical focal point in 0..100 used as
     * `object-position-y %` so the user can pick which slice of a
     * tall image is visible inside the fixed-height banner.
     */
    coverUrl: text('cover_url'),
    coverPosition: integer('cover_position').notNull().default(50),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  },
  (t) => [
    index('notes_owner_updated_idx').on(t.ownerId, t.updatedAt.desc()),
    index('notes_owner_pinned_idx').on(t.ownerId, t.isPinned, t.updatedAt.desc()),
    index('notes_owner_folder_pos_idx').on(t.ownerId, t.folderId, t.position),
    index('notes_owner_today_pinned_idx').on(t.ownerId, t.isPinnedOnToday, t.position),
    index('notes_plaintext_trgm_idx').using('gin', sql`${t.plaintext} gin_trgm_ops`),
    index('notes_owner_deleted_idx').on(t.ownerId, t.deletedAt),
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

/**
 * Per-note AI chat messages. Each user has their own thread per note
 * (multi-collaborator shared threads can be added later). Citations
 * is a JSON array of `{label, noteId, title}` so the UI can render
 * clickable references in the assistant message.
 */
export const chatRole = pgEnum('chat_role', ['user', 'assistant', 'system']);

export const noteChatMessages = pgTable(
  'note_chat_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: chatRole('role').notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').$type<Array<{
      label: string;
      noteId: string;
      title: string;
    }> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('note_chat_msgs_idx').on(t.noteId, t.userId, t.createdAt)],
);

/**
 * Comments on a note. `anchor` is jsonb so we don't fan out a column per
 * variant — `{kind:'note'}`, `{kind:'block', blockId}`,
 * `{kind:'element', elementId}` (Excalidraw-canonical surface), or
 * `{kind:'canvas', x, y}`. Replies are a single level deep: `parentId`
 * is null for top-level comments.
 */
export const noteComments = pgTable(
  'note_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => noteComments.id, {
      onDelete: 'cascade',
    }),
    body: text('body').notNull(),
    anchor: jsonb('anchor')
      .$type<
        | { kind: 'note' }
        | { kind: 'block'; blockId: string }
        | { kind: 'element'; elementId: string }
        | { kind: 'canvas'; x: number; y: number }
      >()
      .notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('note_comments_note_idx').on(t.noteId, t.createdAt),
    index('note_comments_parent_idx').on(t.parentId),
  ],
);

/** Mention fan-out: one row per @-user inside a comment. */
export const noteCommentMentions = pgTable(
  'note_comment_mentions',
  {
    commentId: text('comment_id')
      .notNull()
      .references(() => noteComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('note_comment_mentions_unq').on(t.commentId, t.userId)],
);

/**
 * In-app notifications. Generic — `kind` discriminates the payload.
 * Comments and invites are the first producers; future kinds can land
 * without a schema change.
 */
export const notificationKind = pgEnum('notification_kind', [
  'comment_mention',
  'comment_reply',
  'invite_received',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    payload: jsonb('payload')
      .$type<{
        noteId?: string;
        noteTitle?: string;
        commentId?: string;
        fromUserId?: string;
        fromUserName?: string;
        snippet?: string;
      }>()
      .notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt.desc())],
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
