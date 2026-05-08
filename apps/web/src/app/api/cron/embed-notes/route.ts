import { NextResponse } from 'next/server';
import { db, notes, eq, and, isNull, lt, or, isNotNull, sql, asc } from '@notai/db';
import { embedText } from '@/server/openai';
import { env } from '@notai/lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron-triggered batch embedding worker. Selects up to N notes whose
 * `embedding_updated_at` is null or older than `updated_at` (i.e. the
 * note has been edited since we last embedded it) and re-embeds them.
 *
 * Authenticated by Vercel cron header OR a shared CRON_SECRET, exactly
 * like the trash purge endpoint.
 */
export async function GET(req: Request) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const auth = req.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  const authorized =
    cronHeader === '1' ||
    (cronSecret ? auth === `Bearer ${cronSecret}` : false);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!env.OPENAI_API_KEY) {
    return NextResponse.json({
      skipped:
        'No server-level OPENAI_API_KEY set. Per-user BYOK keys are not used by the cron job — set OPENAI_API_KEY in env to enable background embedding for all users.',
    });
  }

  // Stale = either never embedded, or embedded before the last edit.
  const stale = await db
    .select({
      id: notes.id,
      plaintext: notes.plaintext,
      title: notes.title,
    })
    .from(notes)
    .where(
      and(
        isNull(notes.deletedAt),
        or(
          isNull(notes.embeddingUpdatedAt),
          lt(notes.embeddingUpdatedAt, notes.updatedAt),
        ),
      ),
    )
    .orderBy(asc(notes.updatedAt))
    .limit(100);

  let embedded = 0;
  let failed = 0;
  for (const n of stale) {
    const text = `${n.title}\n\n${n.plaintext ?? ''}`;
    try {
      // null userId → dispatcher uses the server-level OPENAI_API_KEY.
      const result = await embedText(text, null);
      if (!result) {
        failed += 1;
        continue;
      }
      // pgvector accepts the bracketed text representation `[1,2,…]`.
      await db
        .update(notes)
        .set({
          embedding: result.embedding,
          embeddingModel: result.model,
          embeddingUpdatedAt: new Date(),
        })
        .where(eq(notes.id, n.id));
      embedded += 1;
    } catch (err) {
      console.error('[embed] failed for', n.id, err);
      failed += 1;
    }
  }

  return NextResponse.json({ embedded, failed, total: stale.length });
}

void isNotNull;
void sql;
