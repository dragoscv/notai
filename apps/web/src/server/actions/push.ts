'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, pushSubscriptions, eq, and, sql } from '@notai/db';

/**
 * Persist a push subscription for the signed-in user. Supports both
 * Web Push (default `platform: 'web'`, requires p256dh + auth) and
 * native mobile push via FCM (`platform: 'ios' | 'android'`, requires
 * `deviceId` so a single device replaces its token in place across
 * reinstalls instead of accumulating stale rows).
 *
 * Idempotency:
 *   * web rows: on conflict on `endpoint` do nothing.
 *   * mobile rows: on conflict on `(user_id, device_id, platform)`
 *     update the endpoint (which is the FCM token for mobile).
 */

const subSchema = z.object({
  endpoint: z.string().max(4096),
  p256dh: z.string().max(200).optional(),
  auth: z.string().max(200).optional(),
  platform: z.enum(['web', 'ios', 'android']).default('web'),
  deviceId: z.string().min(1).max(200).optional(),
  userAgent: z.string().max(400).optional(),
});

export async function registerPushSubscription(input: z.input<typeof subSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const parsed = subSchema.parse(input);

  if (parsed.platform === 'web') {
    // Web Push requires the VAPID key pair.
    if (!parsed.p256dh || !parsed.auth) {
      throw new Error('p256dh and auth are required for web push');
    }
    await db
      .insert(pushSubscriptions)
      .values({
        id: randomBytes(8).toString('hex'),
        userId: session.user.id,
        endpoint: parsed.endpoint,
        p256dh: parsed.p256dh,
        auth: parsed.auth,
        platform: 'web',
        deviceId: null,
        userAgent: parsed.userAgent ?? null,
      })
      .onConflictDoNothing({ target: pushSubscriptions.endpoint });
    return;
  }

  // Native mobile: deviceId is mandatory so reinstalls update the token
  // in place via the (user_id, device_id, platform) composite unique.
  if (!parsed.deviceId) {
    throw new Error('deviceId is required for mobile push');
  }
  await db
    .insert(pushSubscriptions)
    .values({
      id: randomBytes(8).toString('hex'),
      userId: session.user.id,
      endpoint: parsed.endpoint,
      p256dh: null,
      auth: null,
      platform: parsed.platform,
      deviceId: parsed.deviceId,
      userAgent: parsed.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.deviceId, pushSubscriptions.platform],
      set: {
        endpoint: sql`excluded.endpoint`,
        userAgent: sql`excluded.user_agent`,
      },
    });
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
