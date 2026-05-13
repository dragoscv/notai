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
import { randomBytes } from 'node:crypto';
import {
  db,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  folders,
  notes,
  noteCollaborators,
  tags,
  noteTags,
  assets,
  type OauthToken,
} from '@notai/db';
import { dispatchNoteEvent } from '@/server/actions/webhooks';

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

// ─── Tags ────────────────────────────────────────────────────────────────

export async function apiListTags(userId: string) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color, createdAt: tags.createdAt })
    .from(tags)
    .where(eq(tags.ownerId, userId))
    .orderBy(asc(tags.name));
}

export async function apiCreateTag(userId: string, name: string, color?: string) {
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) return null;
  // Reuse if a tag with the same name already exists.
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.ownerId, userId), eq(tags.name, cleanName)))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(tags)
    .values({ ownerId: userId, name: cleanName, color: color ?? 'default' })
    .returning();
  return row ?? null;
}

export async function apiListNoteTags(userId: string, noteId: string) {
  const note = await apiGetNote(userId, noteId);
  if (!note) return null;
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(noteTags)
    .innerJoin(tags, eq(tags.id, noteTags.tagId))
    .where(eq(noteTags.noteId, noteId))
    .orderBy(asc(tags.name));
  return rows;
}

export async function apiTagNote(userId: string, noteId: string, tagId: string) {
  // Validate ownership of both note and tag.
  const note = await apiGetNote(userId, noteId);
  if (!note) return null;
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.ownerId, userId)))
    .limit(1);
  if (!tag) return null;
  await db.insert(noteTags).values({ noteId, tagId }).onConflictDoNothing();
  return { noteId, tagId };
}

export async function apiUntagNote(userId: string, noteId: string, tagId: string) {
  const note = await apiGetNote(userId, noteId);
  if (!note) return null;
  await db.delete(noteTags).where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));
  return { noteId, tagId };
}

// ─── Attachments ─────────────────────────────────────────────────────────

export async function apiListAssets(userId: string, noteId: string) {
  const note = await apiGetNote(userId, noteId);
  if (!note) return null;
  return db
    .select({
      id: assets.id,
      url: assets.url,
      mime: assets.mime,
      sizeBytes: assets.sizeBytes,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(eq(assets.noteId, noteId))
    .orderBy(desc(assets.createdAt));
}

// ─── Public share ────────────────────────────────────────────────────────

export interface EnablePublicShareInput {
  noteId: string;
  expiresInDays?: number;
}

export async function apiEnablePublicShare(
  userId: string,
  input: EnablePublicShareInput,
  origin: string,
) {
  const token = randomBytes(18).toString('base64url');
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const updated = await db
    .update(notes)
    .set({
      publicShareToken: token,
      publicShareExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, input.noteId), eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    .returning({ id: notes.id, slug: notes.publicShareSlug });
  if (updated.length === 0) return null;
  try {
    await dispatchNoteEvent(userId, 'note.published', {
      noteId: input.noteId,
      slug: token,
      publishedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch note.published failed',
      err instanceof Error ? err.message : err,
    );
  }
  const path = updated[0]?.slug ? `/p/${updated[0].slug}` : `/p/${token}`;
  return {
    token,
    expiresAt,
    url: `${origin}${path}`,
  };
}

export async function apiDisablePublicShare(userId: string, noteId: string) {
  const updated = await db
    .update(notes)
    .set({ publicShareToken: null, publicShareExpiresAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .returning({ id: notes.id });
  if (updated.length === 0) return null;
  try {
    await dispatchNoteEvent(userId, 'note.unpublished', {
      noteId,
      unpublishedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      'webhook dispatch note.unpublished failed',
      err instanceof Error ? err.message : err,
    );
  }
  return { disabled: true, id: noteId };
}

export async function apiGetPublicShareStatus(userId: string, noteId: string, origin: string) {
  const [row] = await db
    .select({
      token: notes.publicShareToken,
      expiresAt: notes.publicShareExpiresAt,
      slug: notes.publicShareSlug,
      imageUrl: notes.publicShareImageUrl,
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!row) return null;
  if (!row.token) return { enabled: false as const };
  const path = row.slug ? `/p/${row.slug}` : `/p/${row.token}`;
  return {
    enabled: true as const,
    token: row.token,
    expiresAt: row.expiresAt,
    url: `${origin}${path}`,
    imageUrl: row.imageUrl,
  };
}

// Silence unused-import warning when only some helpers above are imported by callers.
export const _mcp_internals = { inArray };
