'use server';

import { createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, webhookEndpoints, webhookDeliveries, eq, and, desc, sql } from '@notai/db';

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
  const newId = await deliverOne(
    { id: row.endpointId, url: row.url, secret: row.secret },
    row.event,
    body,
  );
  const [fresh] = await db
    .select({ statusCode: webhookDeliveries.statusCode })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, newId))
    .limit(1);
  revalidatePath('/app/settings/webhooks');
  return { statusCode: fresh?.statusCode ?? null };
}

/**
 * Fire-and-forget event dispatcher. Call this from any server action
 * that mutates a note. Looks up active endpoints subscribed to the
 * event, posts the payload with HMAC signing, and persists a per-call
 * delivery record. Failures bump `failureCount`; 5xx in a row should
 * eventually disable the endpoint (deferred to a follow-up cron).
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
  const body = JSON.stringify({
    event,
    deliveredAt: new Date().toISOString(),
    data: payload,
  });
  await Promise.all(
    endpoints
      .filter((ep) => ep.events.split(/\s+/).includes(event))
      .map((ep) => deliverOne(ep, event, body)),
  );
}

// Replay-safe signature: HMAC-SHA256 over `${unixSeconds}.${body}` (Stripe-style).
// Receivers should reject deliveries whose `X-Notai-Timestamp` differs from
// their own clock by more than ~5 minutes.
async function deliverOne(
  ep: { id: string; url: string; secret: string },
  event: string,
  body: string,
): Promise<string> {
  const id = randomBytes(8).toString('hex');
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac('sha256', ep.secret).update(`${ts}.${body}`).digest('hex');
  const started = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Notai-Webhook/1.0',
        'X-Notai-Event': event,
        'X-Notai-Timestamp': ts,
        'X-Notai-Signature': `t=${ts},v1=${sig}`,
        'X-Notai-Delivery-Id': id,
      },
      body,
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
    statusCode = null;
    responseBody = err instanceof Error ? err.message.slice(0, 200) : 'fetch failed';
  }
  const ok = statusCode != null && statusCode >= 200 && statusCode < 300;
  await db.insert(webhookDeliveries).values({
    id,
    endpointId: ep.id,
    event,
    payload: JSON.parse(body),
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
  return id;
}
