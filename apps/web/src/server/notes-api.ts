/**
 * Note operations callable via OAuth-protected APIs (REST + MCP).
 *
 * These deliberately use the same DB primitives as the in-app server
 * actions (see server/actions/notes.ts) but operate on a userId argument
 * (the OAuth token's subject) rather than a session.
 *
 * Note: Yjs-backed content lives in `notes.yjsState`. For tool-level
 * editing we update the plaintext mirror directly; the editor will pick
 * up the change on next open. For richer Yjs-aware writes a future
 * version can route through Hocuspocus.
 */
import {
  db,
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  folders,
  notes,
  noteCollaborators,
  type OauthToken,
} from '@notai/db';

const POSITION_STEP = 1000;

export interface ListNotesOptions {
  folderId?: string | null;
  archived?: boolean;
  favorite?: boolean;
  pinned?: boolean;
  limit?: number;
  offset?: number;
}

export async function apiListNotes(userId: string, opts: ListNotesOptions = {}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const filters = [
    or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
    eq(notes.isArchived, opts.archived ?? false),
  ];
  if (opts.favorite) filters.push(eq(notes.isFavorite, true));
  if (opts.pinned) filters.push(eq(notes.isPinned, true));
  if (opts.folderId === null) filters.push(isNull(notes.folderId));
  else if (opts.folderId) filters.push(eq(notes.folderId, opts.folderId));

  const rows = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      color: notes.color,
      kind: notes.kind,
      folderId: notes.folderId,
      isPinned: notes.isPinned,
      isArchived: notes.isArchived,
      isFavorite: notes.isFavorite,
      ownerId: notes.ownerId,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      preview: sql<string>`substring(${notes.plaintext} from 1 for 240)`.as('preview'),
    })
    .from(notes)
    .leftJoin(noteCollaborators, eq(noteCollaborators.noteId, notes.id))
    .where(and(...filters))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function apiSearchNotes(userId: string, query: string, limit = 20) {
  if (!query.trim()) return [];
  const rows = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      kind: notes.kind,
      folderId: notes.folderId,
      updatedAt: notes.updatedAt,
      preview: sql<string>`substring(${notes.plaintext} from 1 for 240)`.as('preview'),
    })
    .from(notes)
    .leftJoin(noteCollaborators, eq(noteCollaborators.noteId, notes.id))
    .where(
      and(
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
        eq(notes.isArchived, false),
        or(ilike(notes.title, `%${query}%`), ilike(notes.plaintext, `%${query}%`)),
      ),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(Math.min(limit, 100));
  return rows;
}

export async function apiGetNote(userId: string, id: string) {
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      color: notes.color,
      kind: notes.kind,
      folderId: notes.folderId,
      plaintext: notes.plaintext,
      isPinned: notes.isPinned,
      isArchived: notes.isArchived,
      isFavorite: notes.isFavorite,
      ownerId: notes.ownerId,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .leftJoin(noteCollaborators, eq(noteCollaborators.noteId, notes.id))
    .where(
      and(eq(notes.id, id), or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId))),
    )
    .limit(1);
  return row ?? null;
}

export interface CreateNoteInput {
  title?: string;
  icon?: string | null;
  kind?: 'note' | 'sticky';
  folderId?: string | null;
  plaintext?: string;
}

export async function apiCreateNote(userId: string, input: CreateNoteInput = {}) {
  const siblings = await db
    .select({ position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, userId),
        input.folderId ? eq(notes.folderId, input.folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(desc(notes.position))
    .limit(1);
  const position = (siblings[0]?.position ?? 0) + POSITION_STEP;

  const [row] = await db
    .insert(notes)
    .values({
      ownerId: userId,
      title: input.title?.slice(0, 200) ?? 'Untitled',
      icon: input.icon ?? null,
      kind: input.kind ?? 'note',
      folderId: input.folderId ?? null,
      plaintext: input.plaintext ?? '',
      position,
    })
    .returning();
  return row ?? null;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  icon?: string | null;
  color?: string;
  plaintext?: string;
  folderId?: string | null;
  isPinned?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
}

export async function apiUpdateNote(userId: string, input: UpdateNoteInput) {
  // Only owner can mutate via OAuth API for now (avoids surprising
  // editors-by-collaboration if a token grants notes:write).
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title.slice(0, 200);
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.plaintext !== undefined) patch.plaintext = input.plaintext;
  if (input.folderId !== undefined) patch.folderId = input.folderId;
  if (input.isPinned !== undefined) patch.isPinned = input.isPinned;
  if (input.isFavorite !== undefined) patch.isFavorite = input.isFavorite;
  if (input.isArchived !== undefined) patch.isArchived = input.isArchived;

  const [row] = await db
    .update(notes)
    .set(patch)
    .where(and(eq(notes.id, input.id), eq(notes.ownerId, userId)))
    .returning();
  return row ?? null;
}

export async function apiArchiveNote(userId: string, id: string) {
  const [row] = await db
    .update(notes)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, userId)))
    .returning();
  return row ? { id: row.id } : null;
}

export async function apiListFolders(userId: string) {
  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.ownerId, userId))
    .orderBy(asc(folders.parentId), asc(folders.position));
  return rows;
}

export async function apiCreateFolder(userId: string, name: string, parentId?: string | null) {
  const [row] = await db
    .insert(folders)
    .values({
      ownerId: userId,
      name: name.slice(0, 200),
      parentId: parentId ?? null,
    })
    .returning();
  return row ?? null;
}

/** Tiny wrapper exposing token + user id so MCP/REST handlers don't repeat themselves. */
export type ApiCaller = { token: OauthToken; userId: string };
