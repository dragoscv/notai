import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyApiKey } from '@/server/actions/api-keys';
import { dispatchNoteEvent } from '@/server/actions/webhooks';
import { apiCreateNote } from '@/server/notes-api';
import { db, notes, eq, and, isNull, desc } from '@notai/db';

export const runtime = 'nodejs';

/**
 * GET /api/v1/notes
 *   Authorization: Bearer nk_...
 *   Lists up to 50 of the caller's most recently updated notes.
 *
 * POST /api/v1/notes
 *   Body: { title?, plaintext?, icon?, folderId? }
 *   Creates a new note owned by the API key holder.
 */

const createSchema = z.object({
  title: z.string().max(200).optional(),
  plaintext: z.string().max(200_000).optional(),
  icon: z.string().max(8).optional().nullable(),
  folderId: z.string().min(1).optional().nullable(),
});

export async function GET(req: Request) {
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return jsonError(401, 'unauthorized');
  if (!auth.scopes.includes('notes:read')) return jsonError(403, 'missing scope notes:read');
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      kind: notes.kind,
      updatedAt: notes.updatedAt,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(eq(notes.ownerId, auth.userId), isNull(notes.deletedAt)))
    .orderBy(desc(notes.updatedAt))
    .limit(50);
  return NextResponse.json({ notes: rows });
}

export async function POST(req: Request) {
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return jsonError(401, 'unauthorized');
  if (!auth.scopes.includes('notes:write')) return jsonError(403, 'missing scope notes:write');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'invalid json');
  }
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? 'invalid input');
  }
  const created = await apiCreateNote(auth.userId, parsed.data);
  if (!created) return jsonError(500, 'create failed');
  void dispatchNoteEvent(auth.userId, 'note.created', {
    id: created.id,
    title: created.title,
  });
  return NextResponse.json({ id: created.id, title: created.title }, { status: 201 });
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
