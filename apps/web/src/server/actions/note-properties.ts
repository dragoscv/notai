'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  notes,
  noteCollaborators,
  noteProperties,
  eq,
  and,
  or,
  asc,
  sql,
  inArray,
} from '@notai/db';
import { revalidatePath } from 'next/cache';

/**
 * Per-note structured properties. Lightweight: no schema/database
 * concept on top — every note can carry whatever keys it wants.
 * Distinct keys for the user are exposed via `listPropertyKeys` to
 * power autocomplete.
 */

const VALUE_TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'url'] as const;
type ValueType = (typeof VALUE_TYPES)[number];

const setSchema = z.object({
  noteId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[^\s]/, 'Key cannot start with whitespace'),
  valueType: z.enum(VALUE_TYPES),
  valueText: z.string().max(2000).nullable().optional(),
  valueNumber: z.number().finite().nullable().optional(),
  valueDate: z.string().datetime().nullable().optional(),
  valueBool: z.boolean().nullable().optional(),
});

export interface NotePropertyDTO {
  id: string;
  key: string;
  valueType: ValueType;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null; // ISO
  valueBool: boolean | null;
  position: number;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sign in required');
  return session.user.id;
}

async function requireNoteAccess(noteId: string, userId: string) {
  const [row] = await db
    .select({ id: notes.id })
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
  if (!row) throw new Error('Note not found');
}

export async function listNoteProperties(noteId: string): Promise<NotePropertyDTO[]> {
  const userId = await requireUser();
  await requireNoteAccess(noteId, userId);
  const rows = await db
    .select({
      id: noteProperties.id,
      key: noteProperties.key,
      valueType: noteProperties.valueType,
      valueText: noteProperties.valueText,
      valueNumber: noteProperties.valueNumber,
      valueDate: noteProperties.valueDate,
      valueBool: noteProperties.valueBool,
      position: noteProperties.position,
    })
    .from(noteProperties)
    .where(eq(noteProperties.noteId, noteId))
    .orderBy(asc(noteProperties.position), asc(noteProperties.key));
  return rows.map((r) => ({
    ...r,
    valueType: r.valueType as ValueType,
    valueNumber: r.valueNumber == null ? null : Number(r.valueNumber),
    valueDate: r.valueDate ? r.valueDate.toISOString() : null,
  }));
}

export async function setNoteProperty(input: z.input<typeof setSchema>) {
  const userId = await requireUser();
  const data = setSchema.parse(input);
  await requireNoteAccess(data.noteId, userId);

  // Normalise — only the slot matching valueType is stored.
  const row = {
    ownerId: userId,
    noteId: data.noteId,
    key: data.key.trim(),
    valueType: data.valueType,
    valueText:
      data.valueType === 'text' || data.valueType === 'select' || data.valueType === 'url'
        ? (data.valueText ?? null)
        : null,
    valueNumber:
      data.valueType === 'number' ? ((data.valueNumber ?? null)?.toString() ?? null) : null,
    valueDate: data.valueType === 'date' && data.valueDate ? new Date(data.valueDate) : null,
    valueBool: data.valueType === 'checkbox' ? (data.valueBool ?? false) : null,
    updatedAt: new Date(),
  };

  await db
    .insert(noteProperties)
    .values(row)
    .onConflictDoUpdate({
      target: [noteProperties.noteId, noteProperties.key],
      set: {
        valueType: row.valueType,
        valueText: row.valueText,
        valueNumber: row.valueNumber,
        valueDate: row.valueDate,
        valueBool: row.valueBool,
        updatedAt: row.updatedAt,
      },
    });

  revalidatePath(`/app/n/${data.noteId}`);
}

export async function removeNoteProperty(input: { noteId: string; key: string }) {
  const userId = await requireUser();
  const { noteId, key } = z
    .object({ noteId: z.string().min(1), key: z.string().min(1).max(60) })
    .parse(input);
  await requireNoteAccess(noteId, userId);
  await db
    .delete(noteProperties)
    .where(and(eq(noteProperties.noteId, noteId), eq(noteProperties.key, key.trim())));
  revalidatePath(`/app/n/${noteId}`);
}

/** Distinct keys the user has used, ordered by frequency (descending). */
export async function listPropertyKeys(): Promise<Array<{ key: string; uses: number }>> {
  const userId = await requireUser();
  const rows = await db
    .select({
      key: noteProperties.key,
      uses: sql<number>`count(*)::int`,
    })
    .from(noteProperties)
    .where(eq(noteProperties.ownerId, userId))
    .groupBy(noteProperties.key)
    .orderBy(sql`count(*) desc`)
    .limit(200);
  return rows;
}

/**
 * Find notes the current user can read whose property `key` matches
 * a given text value (exact, case-insensitive). Useful for "show me
 * everything tagged Status: Doing" queries.
 */
export async function listNotesByProperty(input: { key: string; value: string }) {
  const userId = await requireUser();
  const { key, value } = z
    .object({ key: z.string().min(1).max(60), value: z.string().min(1).max(2000) })
    .parse(input);
  const rows = await db
    .select({ noteId: noteProperties.noteId })
    .from(noteProperties)
    .where(
      and(
        eq(noteProperties.ownerId, userId),
        eq(noteProperties.key, key.trim()),
        sql`lower(${noteProperties.valueText}) = lower(${value.trim()})`,
      ),
    )
    .limit(500);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.noteId);
  const found = await db
    .select({ id: notes.id, title: notes.title, icon: notes.icon, updatedAt: notes.updatedAt })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), inArray(notes.id, ids)));
  return found.map((n) => ({ ...n, updatedAt: n.updatedAt.toISOString() }));
}

/**
 * Tabular projection: every note the current user owns that has a
 * property with `key`, joined with all OTHER properties on that note
 * so the caller can render a wide table. Bounded at 500 notes.
 */
export interface DatabaseRow {
  noteId: string;
  noteTitle: string;
  noteIcon: string | null;
  updatedAt: string;
  /** key → string-rendered value (one per cell) */
  cells: Record<string, string>;
}

export interface DatabaseProjection {
  rows: DatabaseRow[];
  /** Distinct keys across all rows, in insertion order. */
  columns: string[];
}

export async function listNotesByPropertyKey(key: string): Promise<DatabaseProjection> {
  const userId = await requireUser();
  const cleanKey = z.string().min(1).max(60).parse(key.trim());

  const noteIdRows = await db
    .selectDistinct({ noteId: noteProperties.noteId })
    .from(noteProperties)
    .where(and(eq(noteProperties.ownerId, userId), eq(noteProperties.key, cleanKey)))
    .limit(500);
  const ids = noteIdRows.map((r) => r.noteId);
  if (ids.length === 0) return { rows: [], columns: [] };

  const noteRows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), inArray(notes.id, ids)));

  const allProps = await db
    .select({
      noteId: noteProperties.noteId,
      key: noteProperties.key,
      valueType: noteProperties.valueType,
      valueText: noteProperties.valueText,
      valueNumber: noteProperties.valueNumber,
      valueDate: noteProperties.valueDate,
      valueBool: noteProperties.valueBool,
    })
    .from(noteProperties)
    .where(and(eq(noteProperties.ownerId, userId), inArray(noteProperties.noteId, ids)));

  const byNote = new Map<string, Record<string, string>>();
  const colOrder: string[] = [cleanKey];
  const seenCols = new Set([cleanKey]);
  for (const p of allProps) {
    const cell = byNote.get(p.noteId) ?? {};
    cell[p.key] = renderCell(p);
    byNote.set(p.noteId, cell);
    if (!seenCols.has(p.key)) {
      seenCols.add(p.key);
      colOrder.push(p.key);
    }
  }

  const rows: DatabaseRow[] = noteRows.map((n) => ({
    noteId: n.id,
    noteTitle: n.title,
    noteIcon: n.icon,
    updatedAt: n.updatedAt.toISOString(),
    cells: byNote.get(n.id) ?? {},
  }));
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { rows, columns: colOrder };
}

function renderCell(p: {
  valueType: string;
  valueText: string | null;
  valueNumber: string | number | null;
  valueDate: Date | null;
  valueBool: boolean | null;
}): string {
  switch (p.valueType) {
    case 'number':
      return p.valueNumber == null ? '' : String(p.valueNumber);
    case 'date':
      return p.valueDate ? p.valueDate.toISOString().slice(0, 10) : '';
    case 'checkbox':
      return p.valueBool ? '✓' : '';
    case 'url':
    case 'select':
    case 'text':
    default:
      return p.valueText ?? '';
  }
}
