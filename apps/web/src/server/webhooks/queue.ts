import 'server-only';
import { Queue, type JobsOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { env } from '@notai/lib';

/**
 * BullMQ-backed retry queue for outbound webhook deliveries.
 *
 * Why a queue at all: the previous dispatcher fired `Promise.all(fetch)`
 * inline on every note mutation. A flaky receiver would either time out
 * the request handler or silently drop the delivery — the user only
 * found out by squinting at `webhook_deliveries`. The queue gives us:
 *
 *   * Five attempts with exponential backoff (2s → 4s → 8s → 16s → 32s).
 *   * Failed jobs retained for 7 days so the user can inspect / resend.
 *   * The producer (note mutation) returns immediately — receiver
 *     latency never blocks the API path.
 *
 * REDIS_URL is required. We *throw* rather than fall back to in-memory
 * because a silent fallback in production would re-introduce the exact
 * silent-drop class of bug we're fixing here.
 */

export const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';

export interface WebhookJobData {
  endpointId: string;
  event: string;
  /** Pre-serialised JSON body so the signature timestamp can be regenerated per attempt. */
  body: string;
}

let cachedConnection: Redis | null = null;
let cachedQueue: Queue<WebhookJobData> | null = null;

function getConnection(): Redis {
  if (cachedConnection) return cachedConnection;
  const url = env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is not configured. The webhook queue needs a Redis backend ' +
        '(Upstash Redis works: set REDIS_URL=rediss://default:<token>@<host>:<port>).',
    );
  }
  cachedConnection = new IORedis(url, {
    // BullMQ requires this; otherwise blocking commands throw on disconnect.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return cachedConnection;
}

export function getWebhookQueue(): Queue<WebhookJobData> {
  if (cachedQueue) return cachedQueue;
  cachedQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 60 * 60, count: 1000 },
      removeOnFail: { age: 60 * 60 * 24 * 7 },
    },
  });
  return cachedQueue;
}

export async function enqueueWebhook(data: WebhookJobData, opts?: JobsOptions): Promise<string> {
  const job = await getWebhookQueue().add('deliver', data, opts);
  return job.id ?? '';
}

/**
 * Used by the worker route to share one connection between Worker and
 * any inline reads (e.g. queue stats endpoint).
 */
export function getRedisConnection(): Redis {
  return getConnection();
}
