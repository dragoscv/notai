import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { db, webhookEndpoints, webhookDeliveries, eq, sql } from '@notai/db';

/**
 * One HTTP delivery attempt. Used by the BullMQ worker (per attempt) and
 * by `redeliverWebhook` (for manual replays from the dashboard). Pure —
 * does NOT enqueue retries; the queue handles retry/backoff.
 *
 * Throws on transport errors so BullMQ's `attempts` counter advances.
 * Persists a `webhook_deliveries` row on every attempt (success or fail)
 * so the dashboard delivery log shows every retry, not just the final one.
 */
export async function deliverOnce(args: {
  endpointId: string;
  event: string;
  /** Pre-serialised JSON envelope. Timestamp + signature are regenerated per attempt. */
  body: string;
}): Promise<{ deliveryId: string; statusCode: number | null; ok: boolean }> {
  const [ep] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, args.endpointId))
    .limit(1);
  if (!ep) {
    // Endpoint was deleted between enqueue and processing — treat as a
    // permanent success so BullMQ stops retrying. There's nothing to log.
    return { deliveryId: '', statusCode: null, ok: true };
  }

  const id = randomBytes(8).toString('hex');
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac('sha256', ep.secret).update(`${ts}.${args.body}`).digest('hex');
  const started = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let transportError: Error | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Notai-Webhook/1.0',
        'X-Notai-Event': args.event,
        'X-Notai-Timestamp': ts,
        'X-Notai-Signature': `t=${ts},v1=${sig}`,
        'X-Notai-Delivery-Id': id,
      },
      body: args.body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    statusCode = res.status;
    try {
      responseBody = (await res.text()).slice(0, 1000);
    } catch {
      responseBody = null;
    }
  } catch (err) {
    transportError = err instanceof Error ? err : new Error('fetch failed');
    responseBody = transportError.message.slice(0, 200);
  }

  const ok = statusCode != null && statusCode >= 200 && statusCode < 300;

  await db.insert(webhookDeliveries).values({
    id,
    endpointId: ep.id,
    event: args.event,
    payload: JSON.parse(args.body),
    statusCode,
    responseBody,
    durationMs: Date.now() - started,
  });

  await db
    .update(webhookEndpoints)
    .set(
      ok
        ? { lastSuccessAt: new Date(), failureCount: 0 }
        : {
            lastFailureAt: new Date(),
            failureCount: sql`${webhookEndpoints.failureCount} + 1`,
          },
    )
    .where(eq(webhookEndpoints.id, ep.id));

  // Re-throw transport errors so BullMQ retries. 4xx/5xx HTTP responses
  // also throw — the receiver explicitly rejected the delivery.
  if (transportError) throw transportError;
  if (!ok) {
    throw new Error(`webhook delivery returned status ${statusCode ?? 'unknown'}`);
  }

  return { deliveryId: id, statusCode, ok };
}
