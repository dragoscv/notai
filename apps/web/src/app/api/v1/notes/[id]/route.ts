import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyApiKey } from '@/server/actions/api-keys';
import { dispatchNoteEvent } from '@/server/actions/webhooks';
import { apiGetNote, apiUpdateNote, apiArchiveNote } from '@/server/notes-api';

export const runtime = 'nodejs';

const updateSchema = z.object({
  title: z.string().max(200).optional(),
  plaintext: z.string().max(200_000).optional(),
  icon: z.string().max(8).optional().nullable(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return err(401, 'unauthorized');
  if (!auth.scopes.includes('notes:read')) return err(403, 'missing scope notes:read');
  const { id } = await params;
  const note = await apiGetNote(auth.userId, id);
  if (!note) return err(404, 'not found');
  return NextResponse.json({ note });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return err(401, 'unauthorized');
  if (!auth.scopes.includes('notes:write')) return err(403, 'missing scope notes:write');
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, 'invalid json');
  }
  const parsed = updateSchema.safeParse(body ?? {});
  if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'invalid');
  const updated = await apiUpdateNote(auth.userId, { id, ...parsed.data });
  if (!updated) return err(404, 'not found');
  void dispatchNoteEvent(auth.userId, 'note.updated', { id: updated.id, title: updated.title });
  return NextResponse.json({ note: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return err(401, 'unauthorized');
  if (!auth.scopes.includes('notes:write')) return err(403, 'missing scope notes:write');
  const { id } = await params;
  const ok = await apiArchiveNote(auth.userId, id);
  if (!ok) return err(404, 'not found');
  void dispatchNoteEvent(auth.userId, 'note.archived', { id });
  return NextResponse.json({ ok: true });
}

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
