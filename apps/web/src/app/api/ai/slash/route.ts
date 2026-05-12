import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { streamSlashAi } from '@/server/actions/slash-ai';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST → NDJSON stream of {type:'delta'|'done'|'error'} lines. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = await rateLimit({
    name: 'api-ai-slash',
    key: userId,
    windowSec: 60,
    max: 30,
  });
  if (!limit.ok) return tooManyRequests(limit);
  const json = await req.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await streamSlashAi(json, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bad request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
