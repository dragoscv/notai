import { NextResponse } from 'next/server';
import { Worker } from 'bullmq';
import { env } from '@notai/lib';
import {
  WEBHOOK_QUEUE_NAME,
  getRedisConnection,
  type WebhookJobData,
} from '@/server/webhooks/queue';
import { deliverOnce } from '@/server/webhooks/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * BullMQ worker tick. Spins up a worker, drains the `webhook-deliveries`
 * queue for ~50s, then closes cleanly so the function returns within the
 * 60s Vercel limit.
 *
 * Authenticated by Vercel cron header OR a shared CRON_SECRET, exactly
 * like the other cron routes in this app. Schedule: every minute.
 *
 * If REDIS_URL is unset the worker can't run — return 503 so the cron
 * surface logs it loudly. We *don't* fall back to inline delivery for
 * the same reason the producer doesn't: silent degradation here would
 * leave deliveries permanently stuck in nowhere.
 */
export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const auth = req.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  const ok = cronHeader === '1' || (cronSecret != null && auth === `Bearer ${cronSecret}`);
  if (!ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!env.REDIS_URL) {
    return NextResponse.json({ error: 'REDIS_URL not configured', processed: 0 }, { status: 503 });
  }

  let processed = 0;
  let failed = 0;
  const startedAt = Date.now();
  // Run the worker for ~50s, leaving ~10s headroom for in-flight HTTP
  // attempts to finish before we close cleanly inside the 60s function
  // limit.
  const drainBudgetMs = 50_000;

  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      await deliverOnce({
        endpointId: job.data.endpointId,
        event: job.data.event,
        body: job.data.body,
      });
    },
    {
      connection: getRedisConnection(),
      // Modest concurrency — each job opens an outbound socket; we don't
      // want one cron tick to exhaust the function's socket budget if a
      // user has hundreds of failed deliveries queued.
      concurrency: 5,
      autorun: true,
      stalledInterval: 30_000,
    },
  );

  worker.on('completed', () => {
    processed += 1;
  });
  worker.on('failed', () => {
    failed += 1;
  });

  await sleep(drainBudgetMs);
  await worker.close();

  return NextResponse.json({
    ok: true,
    processed,
    failed,
    durationMs: Date.now() - startedAt,
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
