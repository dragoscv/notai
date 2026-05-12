'use server';

import { z } from 'zod';
import {
  db,
  notes,
  noteCollaborators,
  noteComments,
  noteCommentMentions,
  notifications,
  users,
  eq,
  and,
  or,
  asc,
  inArray,
} from '@notai/db';
import { auth } from '@/auth';
import { dispatchNoteEvent } from '@/server/actions/webhooks';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string; name?: string | null };
}

async function requireNoteAccess(noteId: string, userId: string) {
  const [row] = await db
    .select({ id: notes.id, title: notes.title, ownerId: notes.ownerId })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        eq(notes.id, noteId),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Not found');
  return row;
}

async function listMembers(noteId: string) {
  const [note] = await db
    .select({ ownerId: notes.ownerId })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!note) return [];
  const collabs = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(noteCollaborators)
    .innerJoin(users, eq(users.id, noteCollaborators.userId))
    .where(eq(noteCollaborators.noteId, noteId));
  const [owner] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(eq(users.id, note.ownerId))
    .limit(1);
  const all = owner ? [owner, ...collabs] : collabs;
  // Deduplicate (owner could appear in collabs too in theory).
  const seen = new Set<string>();
  return all.filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
}

export interface MentionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/** Picker source for the `@` mention extension. Filters by name/email prefix. */
export async function searchMentionableUsers(
  noteId: string,
  query: string,
): Promise<MentionUser[]> {
  const me = await requireUser();
  await requireNoteAccess(noteId, me.id);
  const members = await listMembers(noteId);
  const q = query.trim().toLowerCase();
  if (!q) return members.slice(0, 8);
  return members
    .filter((m) => {
      const name = (m.name ?? '').toLowerCase();
      const email = (m.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .slice(0, 8);
}

export interface CommentRow {
  id: string;
  noteId: string;
  userId: string;
  parentId: string | null;
  body: string;
  anchor:
    | { kind: 'note' }
    | { kind: 'block'; blockId: string }
    | { kind: 'element'; elementId: string }
    | { kind: 'canvas'; x: number; y: number };
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; email: string | null; image: string | null };
  mentionUserIds: string[];
}

export async function listComments(noteId: string): Promise<CommentRow[]> {
  const me = await requireUser();
  await requireNoteAccess(noteId, me.id);
  const rows = await db
    .select({
      id: noteComments.id,
      noteId: noteComments.noteId,
      userId: noteComments.userId,
      parentId: noteComments.parentId,
      body: noteComments.body,
      anchor: noteComments.anchor,
      resolvedAt: noteComments.resolvedAt,
      createdAt: noteComments.createdAt,
      updatedAt: noteComments.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(noteComments)
    .innerJoin(users, eq(users.id, noteComments.userId))
    .where(eq(noteComments.noteId, noteId))
    .orderBy(asc(noteComments.createdAt));
  if (rows.length === 0) return [];
  const mentions = await db
    .select({
      commentId: noteCommentMentions.commentId,
      userId: noteCommentMentions.userId,
    })
    .from(noteCommentMentions)
    .where(
      inArray(
        noteCommentMentions.commentId,
        rows.map((r) => r.id),
      ),
    );
  const mentionMap = new Map<string, string[]>();
  for (const m of mentions) {
    const arr = mentionMap.get(m.commentId) ?? [];
    arr.push(m.userId);
    mentionMap.set(m.commentId, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    noteId: r.noteId,
    userId: r.userId,
    parentId: r.parentId,
    body: r.body,
    anchor: r.anchor as CommentRow['anchor'],
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    author: {
      id: r.userId,
      name: r.authorName,
      email: r.authorEmail,
      image: r.authorImage,
    },
    mentionUserIds: mentionMap.get(r.id) ?? [],
  }));
}

const anchorSchema = z.union([
  z.object({ kind: z.literal('note') }),
  z.object({ kind: z.literal('block'), blockId: z.string().min(1) }),
  z.object({ kind: z.literal('element'), elementId: z.string().min(1) }),
  z.object({
    kind: z.literal('canvas'),
    x: z.number().finite(),
    y: z.number().finite(),
  }),
]);

const addCommentSchema = z.object({
  noteId: z.string().min(1),
  body: z.string().min(1).max(8000),
  anchor: anchorSchema,
  parentId: z.string().min(1).nullable().optional(),
  mentionUserIds: z.array(z.string().min(1)).max(20).default([]),
});

function snippetOf(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function addComment(input: z.input<typeof addCommentSchema>): Promise<CommentRow> {
  const me = await requireUser();
  const parsed = addCommentSchema.parse(input);
  const note = await requireNoteAccess(parsed.noteId, me.id);

  let parentAuthorId: string | null = null;
  if (parsed.parentId) {
    const [parent] = await db
      .select({ id: noteComments.id, userId: noteComments.userId, noteId: noteComments.noteId })
      .from(noteComments)
      .where(eq(noteComments.id, parsed.parentId))
      .limit(1);
    if (!parent || parent.noteId !== parsed.noteId) {
      throw new Error('Invalid parent');
    }
    parentAuthorId = parent.userId;
  }

  const [row] = await db
    .insert(noteComments)
    .values({
      noteId: parsed.noteId,
      userId: me.id,
      parentId: parsed.parentId ?? null,
      body: parsed.body,
      anchor: parsed.anchor,
    })
    .returning({
      id: noteComments.id,
      createdAt: noteComments.createdAt,
      updatedAt: noteComments.updatedAt,
    });
  if (!row) throw new Error('Failed to insert');

  // Mention fan-out: only members of the note can be mentioned.
  const validMembers = new Set((await listMembers(parsed.noteId)).map((m) => m.id));
  const mentioned = parsed.mentionUserIds.filter(
    (id) => validMembers.has(id) && id !== me.id, // don't notify yourself
  );

  if (mentioned.length > 0) {
    await db
      .insert(noteCommentMentions)
      .values(mentioned.map((userId) => ({ commentId: row.id, userId })));
    await db.insert(notifications).values(
      mentioned.map((userId) => ({
        userId,
        kind: 'comment_mention' as const,
        payload: {
          noteId: parsed.noteId,
          noteTitle: note.title ?? undefined,
          commentId: row.id,
          fromUserId: me.id,
          fromUserName: me.name ?? undefined,
          snippet: snippetOf(parsed.body),
        },
      })),
    );
  }

  // Reply notification (only if not also mentioned).
  if (parentAuthorId && parentAuthorId !== me.id && !mentioned.includes(parentAuthorId)) {
    await db.insert(notifications).values({
      userId: parentAuthorId,
      kind: 'comment_reply',
      payload: {
        noteId: parsed.noteId,
        noteTitle: note.title ?? undefined,
        commentId: row.id,
        fromUserId: me.id,
        fromUserName: me.name ?? undefined,
        snippet: snippetOf(parsed.body),
      },
    });
  }

  // Re-fetch to get the joined author + canonical timestamps.
  const [reread] = await listCommentsByIds([row.id]);
  if (!reread) throw new Error('Insert succeeded but reread failed');
  try {
    await dispatchNoteEvent(note.ownerId, 'comment.created', {
      noteId: parsed.noteId,
      commentId: row.id,
      authorUserId: me.id,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch comment.created failed',
      err instanceof Error ? err.message : err,
    );
  }
  return reread;
}

async function listCommentsByIds(ids: string[]): Promise<CommentRow[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: noteComments.id,
      noteId: noteComments.noteId,
      userId: noteComments.userId,
      parentId: noteComments.parentId,
      body: noteComments.body,
      anchor: noteComments.anchor,
      resolvedAt: noteComments.resolvedAt,
      createdAt: noteComments.createdAt,
      updatedAt: noteComments.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(noteComments)
    .innerJoin(users, eq(users.id, noteComments.userId))
    .where(inArray(noteComments.id, ids));
  const mentions = await db
    .select({
      commentId: noteCommentMentions.commentId,
      userId: noteCommentMentions.userId,
    })
    .from(noteCommentMentions)
    .where(inArray(noteCommentMentions.commentId, ids));
  const mentionMap = new Map<string, string[]>();
  for (const m of mentions) {
    const arr = mentionMap.get(m.commentId) ?? [];
    arr.push(m.userId);
    mentionMap.set(m.commentId, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    noteId: r.noteId,
    userId: r.userId,
    parentId: r.parentId,
    body: r.body,
    anchor: r.anchor as CommentRow['anchor'],
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    author: {
      id: r.userId,
      name: r.authorName,
      email: r.authorEmail,
      image: r.authorImage,
    },
    mentionUserIds: mentionMap.get(r.id) ?? [],
  }));
}

const idSchema = z.object({ id: z.string().min(1) });

export async function resolveComment(input: z.input<typeof idSchema>) {
  const me = await requireUser();
  const { id } = idSchema.parse(input);
  const [row] = await db
    .select({ noteId: noteComments.noteId })
    .from(noteComments)
    .where(eq(noteComments.id, id))
    .limit(1);
  if (!row) throw new Error('Not found');
  const note = await requireNoteAccess(row.noteId, me.id);
  await db
    .update(noteComments)
    .set({ resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(noteComments.id, id));
  try {
    await dispatchNoteEvent(note.ownerId, 'comment.resolved', {
      noteId: row.noteId,
      commentId: id,
      resolvedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch comment.resolved failed',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function unresolveComment(input: z.input<typeof idSchema>) {
  const me = await requireUser();
  const { id } = idSchema.parse(input);
  const [row] = await db
    .select({ noteId: noteComments.noteId })
    .from(noteComments)
    .where(eq(noteComments.id, id))
    .limit(1);
  if (!row) throw new Error('Not found');
  await requireNoteAccess(row.noteId, me.id);
  await db
    .update(noteComments)
    .set({ resolvedAt: null, updatedAt: new Date() })
    .where(eq(noteComments.id, id));
}

export async function deleteComment(input: z.input<typeof idSchema>) {
  const me = await requireUser();
  const { id } = idSchema.parse(input);
  const [row] = await db
    .select({
      noteId: noteComments.noteId,
      userId: noteComments.userId,
      ownerId: notes.ownerId,
    })
    .from(noteComments)
    .innerJoin(notes, eq(notes.id, noteComments.noteId))
    .where(eq(noteComments.id, id))
    .limit(1);
  if (!row) throw new Error('Not found');
  // Author or note owner can delete.
  if (row.userId !== me.id && row.ownerId !== me.id) {
    throw new Error('Not allowed');
  }
  await db.delete(noteComments).where(eq(noteComments.id, id));
  try {
    await dispatchNoteEvent(row.ownerId, 'comment.deleted', {
      noteId: row.noteId,
      commentId: id,
      deletedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch comment.deleted failed',
      err instanceof Error ? err.message : err,
    );
  }
}

const rewireSchema = z.object({
  noteId: z.string().min(1),
  // Map of legacy `block.blockId` → new Excalidraw `elementId`.
  mapping: z.record(z.string().min(1), z.string().min(1)),
});

/**
 * After a client-side TipTap-block → Excalidraw migration, rewrite any
 * comment anchored to a migrated block so it points at the new
 * Excalidraw element. Idempotent: comments not in the mapping are left
 * alone, and re-running with the same mapping is a no-op (the second
 * time around the comment's anchor.kind is already 'element').
 *
 * Authorization: only the note owner OR a collaborator can rewire,
 * matching the rest of the comments surface. We don't allow arbitrary
 * users to relabel comments by ID, hence the `requireNoteAccess`
 * gate plus the explicit noteId scope on every UPDATE.
 */
export async function rewireCommentsAfterMigration(
  input: z.input<typeof rewireSchema>,
): Promise<{ updated: number }> {
  const me = await requireUser();
  const { noteId, mapping } = rewireSchema.parse(input);
  await requireNoteAccess(noteId, me.id);

  const entries = Object.entries(mapping);
  if (entries.length === 0) return { updated: 0 };

  const rows = await db
    .select({ id: noteComments.id, anchor: noteComments.anchor })
    .from(noteComments)
    .where(eq(noteComments.noteId, noteId));

  let updated = 0;
  for (const r of rows) {
    const a = r.anchor as CommentRow['anchor'] | null;
    if (!a || a.kind !== 'block') continue;
    const elementId = mapping[a.blockId];
    if (!elementId) continue;
    await db
      .update(noteComments)
      .set({ anchor: { kind: 'element', elementId } })
      .where(eq(noteComments.id, r.id));
    updated += 1;
  }
  return { updated };
}
