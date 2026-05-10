'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  notes,
  noteTags,
  eq,
  and,
  desc,
  asc,
  or,
  noteCollaborators,
  folders,
  isNull,
  isNotNull,
  lt,
  gte,
  inArray,
  ilike,
  sql,
} from '@notai/db';
import { requireQuota } from '@/server/plans';
import { type ViewSpec, type FilterSpec } from '@/lib/view-spec';

/** Position gap between siblings so reorders don't have to renumber neighbours. */
const POSITION_STEP = 1000;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  return session.user;
}

export async function listNotes(filter?: { archived?: boolean; favorite?: boolean }) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(notes)
    .where(
      and(
        or(eq(notes.ownerId, user.id)),
        isNull(notes.deletedAt),
        eq(notes.isArchived, filter?.archived ?? false),
        ...(filter?.favorite ? [eq(notes.isFavorite, true)] : []),
      ),
    )
    // Sidebar groups notes by folder and uses `position` within each;
    // pinned notes still float to the top visually. The outer query
    // keeps it sorted by position so UI can just bucket into folders.
    .orderBy(desc(notes.isPinned), asc(notes.position), desc(notes.updatedAt));

  return rows.map((n) => ({ ...n, previewHtml: buildPreviewHtml(n.plaintext) }));
}

function withinCutoff(value: FilterSpec['updatedWithin']): Date | null {
  if (value === 'any') return null;
  const now = Date.now();
  const ms =
    value === 'today'
      ? 24 * 60 * 60 * 1000
      : value === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}

/**
 * Dashboard query — same shape as `listNotes` but accepts a {@link ViewSpec}
 * so the dashboard can apply sort + filters server-side using existing
 * indexes. The legacy `listNotes()` signature is kept for the sidebar
 * tree which has no use for filters.
 */
export async function listNotesForView(spec: ViewSpec) {
  const user = await requireUser();
  const f = spec.filters;

  // Status filter is a logical OR across pinned/favorite/archived/pinnedOnToday;
  // when nothing is selected we default to "exclude archived" to match the
  // existing dashboard behaviour.
  const statusConds = [];
  if (f.status.includes('pinned')) statusConds.push(eq(notes.isPinned, true));
  if (f.status.includes('favorite')) statusConds.push(eq(notes.isFavorite, true));
  if (f.status.includes('archived')) statusConds.push(eq(notes.isArchived, true));
  if (f.status.includes('pinnedOnToday')) statusConds.push(eq(notes.isPinnedOnToday, true));
  const archivedClause = f.status.includes('archived') ? undefined : eq(notes.isArchived, false);

  const folderClauses = (() => {
    if (f.folderIds.length === 0) return undefined;
    const ids = f.folderIds.filter((x): x is string => x !== null);
    const includesRoot = f.folderIds.includes(null);
    const conds = [];
    if (ids.length > 0) conds.push(inArray(notes.folderId, ids));
    if (includesRoot) conds.push(isNull(notes.folderId));
    return conds.length === 1 ? conds[0] : or(...conds);
  })();

  // Tag filter joins via subquery: notes whose id appears in note_tags for
  // ANY selected tag (logical OR). Empty array = no filter.
  const tagClause =
    f.tagIds.length > 0
      ? inArray(
          notes.id,
          db
            .select({ id: noteTags.noteId })
            .from(noteTags)
            .where(inArray(noteTags.tagId, f.tagIds)),
        )
      : undefined;

  // Has-collaborators flag: only when explicitly true (false would mean
  // "exclude shared", which we don't expose).
  const collabClause = f.hasCollaborators
    ? inArray(notes.id, db.select({ id: noteCollaborators.noteId }).from(noteCollaborators))
    : undefined;

  const cutoff = withinCutoff(f.updatedWithin);
  const dateClause = cutoff ? gte(notes.updatedAt, cutoff) : undefined;

  const searchClause = f.search.trim()
    ? or(ilike(notes.title, `%${f.search.trim()}%`), ilike(notes.plaintext, `%${f.search.trim()}%`))
    : undefined;

  const where = and(
    eq(notes.ownerId, user.id),
    isNull(notes.deletedAt),
    archivedClause,
    statusConds.length > 0 ? or(...statusConds) : undefined,
    folderClauses,
    tagClause,
    collabClause,
    dateClause,
    searchClause,
    f.kinds.length > 0 ? inArray(notes.kind, f.kinds) : undefined,
    f.colors.length > 0 ? inArray(notes.color, f.colors) : undefined,
  );

  const orderBy = (() => {
    const cols = [];
    if (spec.pinnedFirst) cols.push(desc(notes.isPinned));
    if (spec.sort === 'updated') cols.push(desc(notes.updatedAt));
    else if (spec.sort === 'created') cols.push(desc(notes.createdAt));
    else if (spec.sort === 'opened')
      cols.push(sql`coalesce(${notes.lastOpenedAt}, ${notes.updatedAt}) desc`);
    else if (spec.sort === 'alphabetical') cols.push(asc(notes.title));
    else cols.push(asc(notes.position), desc(notes.updatedAt));
    return cols;
  })();

  const rows = await db
    .select()
    .from(notes)
    .where(where)
    .orderBy(...orderBy);

  return rows.map((n) => ({ ...n, previewHtml: buildPreviewHtml(n.plaintext) }));
}

/** Escape HTML, truncate, and convert blank lines into <p> blocks for card previews. */
function buildPreviewHtml(plaintext: string): string {
  const trimmed = (plaintext ?? '').slice(0, 600).trim();
  if (!trimmed) return '';
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  return trimmed
    .split(/\n{2,}/)
    .map((p) => `<p>${escape(p).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export async function getNote(id: string) {
  const user = await requireUser();
  const [note] = await db
    .select()
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, user.id)),
    )
    .where(
      and(
        eq(notes.id, id),
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, user.id), eq(noteCollaborators.userId, user.id)),
      ),
    )
    .limit(1);
  return note?.notes ?? null;
}

const createSchema = z.object({
  title: z.string().max(200).optional().default('Untitled'),
  icon: z.string().max(10).optional(),
  kind: z.enum(['note', 'sticky']).optional().default('note'),
  folderId: z.string().nullable().optional(),
});

export async function createNote(input: z.input<typeof createSchema> = {}) {
  const user = await requireUser();
  const data = createSchema.parse(input);

  await requireQuota(user.id, 'notes');

  // Give the new note a `position` larger than any sibling in the same
  // folder so it lands at the bottom of the list; the sidebar can later
  // reorder it via `reorderNotes`. Using POSITION_STEP gaps keeps future
  // inserts cheap without rewriting neighbours.
  const siblings = await db
    .select({ position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        data.folderId ? eq(notes.folderId, data.folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(desc(notes.position))
    .limit(1);
  const position = (siblings[0]?.position ?? 0) + POSITION_STEP;

  const [note] = await db
    .insert(notes)
    .values({
      ownerId: user.id,
      title: data.title,
      icon: data.icon,
      kind: data.kind,
      folderId: data.folderId ?? null,
      position,
    })
    .returning();

  // Auto-attach the folder's default tags, if any. Best-effort \u2014 tag
  // failures don't block note creation.
  if (note && data.folderId) {
    try {
      const [folder] = await db
        .select({ defaultTagIds: folders.defaultTagIds })
        .from(folders)
        .where(and(eq(folders.id, data.folderId), eq(folders.ownerId, user.id)))
        .limit(1);
      const tagIds = folder?.defaultTagIds ?? [];
      if (tagIds.length > 0) {
        await db
          .insert(noteTags)
          .values(tagIds.map((tagId) => ({ noteId: note.id, tagId })))
          .onConflictDoNothing();
      }
    } catch {
      /* ignore \u2014 tag attach is best-effort */
    }
  }

  revalidatePath('/app');
  return note;
}

const updateSchema = z.object({
  id: z.string(),
  title: z.string().max(200).optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z.string().max(30).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export async function updateNote(input: z.input<typeof updateSchema>) {
  const user = await requireUser();
  const { id, ...patch } = updateSchema.parse(input);
  await db
    .update(notes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
  revalidatePath('/app');
  revalidatePath(`/app/n/${id}`);
}

/**
 * Flip the dashboard-only "pin on Today" flag. Separate from `isPinned`
 * (which drives the sidebar's global Pinned section) so users can curate
 * their daily landing without polluting the sidebar.
 */
export async function togglePinnedOnToday(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({ pinned: notes.isPinnedOnToday })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)))
    .limit(1);
  if (!row) throw new Error('Note not found');
  await db
    .update(notes)
    .set({ isPinnedOnToday: !row.pinned, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
  revalidatePath('/app');
}

/**
 * Soft delete: stamp `deletedAt` so the row disappears from normal
 * queries but stays recoverable for 30 days. The cron purger does the
 * actual DROP. Only owners can delete.
 */
export async function deleteNote(id: string) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNull(notes.deletedAt)));
  revalidatePath('/app');
  revalidatePath('/app/trash');
}

/** Move a soft-deleted note back to the active workspace. */
export async function restoreNote(id: string) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)));
  revalidatePath('/app');
  revalidatePath('/app/trash');
}

/** Permanently delete a single trashed note. Triggers Y.Doc cascade. */
export async function purgeNote(id: string) {
  const user = await requireUser();
  await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)));
  revalidatePath('/app/trash');
}

/** Permanently empty the user's trash (irreversible). */
export async function emptyTrash() {
  const user = await requireUser();
  await db.delete(notes).where(and(eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)));
  revalidatePath('/app/trash');
}

/** List the signed-in user's trashed notes. */
export async function listTrash() {
  const user = await requireUser();
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)))
    .orderBy(desc(notes.deletedAt));
}

/**
 * Cron-callable global purge: hard-deletes any note soft-deleted more than
 * 30 days ago, regardless of owner. Returns the count for logs.
 */
export async function purgeExpiredTrash(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(notes)
    .where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoff)))
    .returning({ id: notes.id });
  return { purged: rows.length };
}

/**
 * Duplicate a note into the same folder. Copies title (prefixed "Copy of"),
 * icon, color and plaintext. The Y.Doc blob is intentionally NOT copied —
 * the new note starts empty from the editor's perspective; users can copy
 * content inside the editor if they want a true clone.
 */
export async function duplicateNote(id: string) {
  const user = await requireUser();
  const [source] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)))
    .limit(1);
  if (!source) throw new Error('Note not found');

  const [next] = await db
    .select({ position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        source.folderId ? eq(notes.folderId, source.folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(desc(notes.position))
    .limit(1);
  const position = (next?.position ?? 0) + POSITION_STEP;

  const [copy] = await db
    .insert(notes)
    .values({
      ownerId: user.id,
      title: `Copy of ${source.title}`,
      icon: source.icon,
      color: source.color,
      kind: source.kind,
      folderId: source.folderId,
      position,
    })
    .returning();
  revalidatePath('/app');
  return copy;
}

/**
 * Returns a markdown payload for a single note. Uses the `plaintext` mirror
 * (kept up to date by the realtime server) and prefixes the title as H1 so
 * the downloaded file opens cleanly in any markdown viewer.
 */
export async function exportNoteMarkdown(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, user.id)),
    )
    .where(
      and(
        eq(notes.id, id),
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, user.id), eq(noteCollaborators.userId, user.id)),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Note not found');

  const title = row.title?.trim() || 'Untitled';
  const safe = title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
  const filename = `${safe || 'note'}.md`;
  const body = (row.plaintext ?? '').trim();
  const content = body ? `# ${title}\n\n${body}\n` : `# ${title}\n`;
  return { filename, content };
}

const moveSchema = z.object({
  noteId: z.string(),
  /** Target folder (null = root). */
  folderId: z.string().nullable(),
  /**
   * Desired index among siblings in the target folder (0-based).
   * When omitted the note is appended at the end.
   */
  index: z.number().int().min(0).optional(),
});

/**
 * Move a note to a different folder and/or reorder it within siblings.
 *
 * Computes a new `position` value between the two neighbours at the given
 * index. When the gap collapses to < 1 it re-normalises the folder's
 * positions with POSITION_STEP spacing (rare, keeps the logic simple).
 */
export async function moveNote(input: z.input<typeof moveSchema>) {
  const user = await requireUser();
  const { noteId, folderId, index } = moveSchema.parse(input);

  // Sanity-check the target folder belongs to the user.
  if (folderId) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, user.id)))
      .limit(1);
    if (!folder) throw new Error('Folder not found');
  }

  const siblings = await db
    .select({ id: notes.id, position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        folderId ? eq(notes.folderId, folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(notes.position);

  // Exclude the dragged note from neighbour calculations (when moving
  // within the same folder).
  const others = siblings.filter((s) => s.id !== noteId);
  const targetIndex = Math.min(index ?? others.length, others.length);
  const before = others[targetIndex - 1]?.position;
  const after = others[targetIndex]?.position;

  let position: number;
  if (before == null && after == null) {
    position = POSITION_STEP;
  } else if (before == null) {
    position = (after as number) - POSITION_STEP;
  } else if (after == null) {
    position = before + POSITION_STEP;
  } else {
    position = (before + after) / 2;
  }

  // If the gap collapsed, renumber the target folder with POSITION_STEP.
  if (after != null && before != null && Math.abs(after - before) < 1) {
    const reordered = [...others];
    reordered.splice(targetIndex, 0, { id: noteId, position: 0 });
    await Promise.all(
      reordered.map((r, i) =>
        db
          .update(notes)
          .set({ position: (i + 1) * POSITION_STEP })
          .where(and(eq(notes.id, r.id), eq(notes.ownerId, user.id))),
      ),
    );
    await db
      .update(notes)
      .set({ folderId: folderId ?? null })
      .where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id)));
  } else {
    await db
      .update(notes)
      .set({ folderId: folderId ?? null, position, updatedAt: new Date() })
      .where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id)));
  }

  revalidatePath('/app');
}

export async function touchNoteOpened(id: string) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ lastOpenedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
}
