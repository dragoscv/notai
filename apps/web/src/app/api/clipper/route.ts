import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, notes } from '@notai/db';
import { authenticatePat, requireScope } from '@/server/pat-auth';

const bodySchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().max(2048).default(''),
  body: z.string().max(60_000).default(''),
  capturedAt: z.string().datetime().optional(),
  kind: z.enum(['page', 'selection', 'empty']).default('page'),
});

/**
 * Browser-extension save endpoint. Authenticates with a PAT (no cookies)
 * and creates a fresh note in the user's workspace.
 */
export async function POST(req: Request) {
  const auth = await authenticatePat(req);
  if (auth instanceof NextResponse) return auth;
  const scoped = requireScope(auth, 'clipper');
  if (scoped) return scoped;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { title, url, body, kind } = parsed.data;

  const lines: string[] = [];
  if (url) lines.push(url);
  if (body) lines.push(body);
  const plaintext = lines.join('\n\n');

  const [row] = await db
    .insert(notes)
    .values({
      ownerId: auth.userId,
      title,
      icon: kind === 'selection' ? '✂️' : '🔖',
      kind: 'note',
      plaintext,
    })
    .returning({ id: notes.id });

  if (!row) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
  const origin = new URL(req.url).origin;
  return NextResponse.json({ id: row.id, url: `${origin}/app/n/${row.id}`, ok: true });
}
