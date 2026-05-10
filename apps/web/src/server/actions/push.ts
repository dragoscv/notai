'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, pushSubscriptions, eq, and } from '@notai/db';

/**
 * Persist a Web Push (PushManager) subscription for the signed-in
 * user. Idempotent on the endpoint URL. Sending notifications is the
 * job of a separate worker (e.g. cron + the `web-push` library) and
 * is left to a follow-up task; here we just collect subscriptions.
 */

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().max(200),
  auth: z.string().max(200),
  userAgent: z.string().max(400).optional(),
});

export async function registerPushSubscription(input: z.input<typeof subSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const parsed = subSchema.parse(input);
  await db
    .insert(pushSubscriptions)
    .values({
      id: randomBytes(8).toString('hex'),
      userId: session.user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent: parsed.userAgent ?? null,
    })
    .onConflictDoNothing({ target: pushSubscriptions.endpoint });
}

export async function unregisterPushSubscription(endpoint: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, session.user.id), eq(pushSubscriptions.endpoint, endpoint)),
    );
}

export async function getVapidPublicKey(): Promise<string | null> {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null;
}
