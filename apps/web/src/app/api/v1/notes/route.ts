import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyApiKey } from '@/server/actions/api-keys';
import { dispatchNoteEvent } from '@/server/actions/webhooks';
import { logApiRequest } from '@/server/api-log';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
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
 *
 * Rate limit: 60 requests/minute per key (read), 30 requests/minute per key (write).
 */

const READ_LIMIT = { name: 'v1-notes-read', windowSec: 60, max: 60 };
const WRITE_LIMIT = { name: 'v1-notes-write', windowSec: 60, max: 30 };

const createSchema = z.object({
  title: z.string().max(200).optional(),
  plaintext: z.string().max(200_000).optional(),
  icon: z.string().max(8).optional().nullable(),
  folderId: z.string().min(1).optional().nullable(),
});

export async function GET(req: Request) {
  const started = Date.now();
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return jsonError(401, 'unauthorized');
  if (!auth.scopes.includes('notes:read')) return jsonError(403, 'missing scope notes:read');
  const rl = await rateLimit({ ...READ_LIMIT, key: auth.apiKeyId });
  if (!rl.ok) {
    logApiRequest({
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      path: '/api/v1/notes',
      method: 'GET',
      status: 429,
      durationMs: Date.now() - started,
    });
    return tooManyRequests(rl);
  }
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
  logApiRequest({
    apiKeyId: auth.apiKeyId,
    userId: auth.userId,
    path: '/api/v1/notes',
    method: 'GET',
    status: 200,
    durationMs: Date.now() - started,
  });
  return NextResponse.json({ notes: rows });
}

export async function POST(req: Request) {
  const started = Date.now();
  const auth = await verifyApiKey(req.headers.get('authorization'));
  if (!auth) return jsonError(401, 'unauthorized');
  if (!auth.scopes.includes('notes:write')) return jsonError(403, 'missing scope notes:write');
  const rl = await rateLimit({ ...WRITE_LIMIT, key: auth.apiKeyId });
  if (!rl.ok) {
    logApiRequest({
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      path: '/api/v1/notes',
      method: 'POST',
      status: 429,
      durationMs: Date.now() - started,
    });
    return tooManyRequests(rl);
  }
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
  logApiRequest({
    apiKeyId: auth.apiKeyId,
    userId: auth.userId,
    path: '/api/v1/notes',
    method: 'POST',
    status: 201,
    durationMs: Date.now() - started,
  });
  return NextResponse.json({ id: created.id, title: created.title }, { status: 201 });
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
