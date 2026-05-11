'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, webhookEndpoints, webhookDeliveries, eq, and, desc } from '@notai/db';
import { enqueueWebhook } from '@/server/webhooks/queue';
import { deliverOnce } from '@/server/webhooks/deliver';

export interface WebhookRow {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: Date;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  failureCount: number;
}

export async function listMyWebhooks(): Promise<WebhookRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      events: webhookEndpoints.events,
      isActive: webhookEndpoints.isActive,
      createdAt: webhookEndpoints.createdAt,
      lastSuccessAt: webhookEndpoints.lastSuccessAt,
      lastFailureAt: webhookEndpoints.lastFailureAt,
      failureCount: webhookEndpoints.failureCount,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.userId, session.user.id));
}

const createSchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((u) => /^https:\/\//i.test(u), 'URL must be https'),
  events: z.string().trim().max(200).optional(),
});

export async function createWebhook(
  input: z.input<typeof createSchema>,
): Promise<{ id: string; secret: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { url, events } = createSchema.parse(input);
  const id = randomBytes(8).toString('hex');
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  await db.insert(webhookEndpoints).values({
    id,
    userId: session.user.id,
    url,
    secret,
    events: events && events.length > 0 ? events : 'note.created note.updated note.archived',
  });
  revalidatePath('/app/settings/webhooks');
  return { id, secret };
}

export async function setWebhookActive(input: { id: string; active: boolean }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .update(webhookEndpoints)
    .set({ isActive: input.active })
    .where(and(eq(webhookEndpoints.id, input.id), eq(webhookEndpoints.userId, session.user.id)));
  revalidatePath('/app/settings/webhooks');
}

export async function deleteWebhook(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, session.user.id)));
  revalidatePath('/app/settings/webhooks');
}

export interface DeliveryRow {
  id: string;
  event: string;
  statusCode: number | null;
  deliveredAt: Date;
  durationMs: number | null;
  responseBody: string | null;
}

export async function listWebhookDeliveries(endpointId: string): Promise<DeliveryRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  // Confirm ownership before disclosing deliveries.
  const [own] = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.userId, session.user.id)))
    .limit(1);
  if (!own) return [];
  return db
    .select({
      id: webhookDeliveries.id,
      event: webhookDeliveries.event,
      statusCode: webhookDeliveries.statusCode,
      deliveredAt: webhookDeliveries.deliveredAt,
      durationMs: webhookDeliveries.durationMs,
      responseBody: webhookDeliveries.responseBody,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.endpointId, endpointId))
    .orderBy(desc(webhookDeliveries.deliveredAt))
    .limit(50);
}

/**
 * Re-fire a previous delivery using its persisted payload. Useful when
 * the receiver was down or returned a transient 5xx and the user wants
 * to retry without waiting for the next event. Re-signs with the
 * current timestamp so replay-protection on the receiver continues to
 * work.
 */
export async function redeliverWebhook(deliveryId: string): Promise<{ statusCode: number | null }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const [row] = await db
    .select({
      id: webhookDeliveries.id,
      event: webhookDeliveries.event,
      payload: webhookDeliveries.payload,
      endpointId: webhookDeliveries.endpointId,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
      ownerId: webhookEndpoints.userId,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!row || row.ownerId !== session.user.id) throw new Error('Not found');
  const body = JSON.stringify(row.payload);
  // Manual replays go through the same delivery path the worker uses,
  // but synchronously — the user is staring at the dialog and wants the
  // status code back. We swallow the throw deliverOnce uses to advance
  // BullMQ's retry counter.
  let result;
  try {
    result = await deliverOnce({
      endpointId: row.endpointId,
      event: row.event,
      body,
    });
  } catch {
    // deliverOnce already wrote a webhook_deliveries row before throwing;
    // surface the recorded status to the dashboard.
    const [last] = await db
      .select({ id: webhookDeliveries.id, statusCode: webhookDeliveries.statusCode })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, row.endpointId))
      .orderBy(desc(webhookDeliveries.deliveredAt))
      .limit(1);
    revalidatePath('/app/settings/webhooks');
    return { statusCode: last?.statusCode ?? null };
  }
  revalidatePath('/app/settings/webhooks');
  return { statusCode: result.statusCode };
}

/**
 * Event dispatcher. Enqueues one BullMQ job per matching active endpoint.
 * The worker (apps/web/src/app/api/cron/webhook-worker/route.ts) handles
 * the actual HTTP delivery + retries with exponential backoff.
 *
 * Throws synchronously if REDIS_URL is unset. The previous fire-and-forget
 * implementation silently dropped on transport errors; failing loudly here
 * forces the missing-config to surface during note mutation rather than
 * being discovered hours later by a customer asking why their integration
 * never fired.
 */
export async function dispatchNoteEvent(
  userId: string,
  event: 'note.created' | 'note.updated' | 'note.archived',
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.userId, userId), eq(webhookEndpoints.isActive, true)));
  if (endpoints.length === 0) return;
  const matched = endpoints.filter((ep) => ep.events.split(/\s+/).includes(event));
  if (matched.length === 0) return;
  const body = JSON.stringify({
    event,
    deliveredAt: new Date().toISOString(),
    data: payload,
  });
  await Promise.all(matched.map((ep) => enqueueWebhook({ endpointId: ep.id, event, body })));
}

// Replay-safe signature: HMAC-SHA256 over `${unixSeconds}.${body}` (Stripe-style).
// Receivers should reject deliveries whose `X-Notai-Timestamp` differs from
// their own clock by more than ~5 minutes. The actual per-attempt logic
// lives in apps/web/src/server/webhooks/deliver.ts so the BullMQ worker
// can call it without importing this 'use server' file.
