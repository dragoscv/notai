import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { askMyNotesStream } from '@/server/actions/ask';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({ question: z.string().min(2).max(2000) });

/** POST { question } → NDJSON stream of {type:'hits'|'delta'|'error'} lines. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = await rateLimit({
    name: 'api-ask',
    key: session.user.id,
    windowSec: 60,
    max: 20,
  });
  if (!limit.ok) return tooManyRequests(limit);
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad question' }, { status: 400 });
  }
  const stream = await askMyNotesStream({ question: parsed.data.question });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
