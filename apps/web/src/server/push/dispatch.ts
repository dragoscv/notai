import webpush from 'web-push';
import { db, pushSubscriptions, eq } from '@notai/db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface DispatchResult {
  sent: number;
  pruned: number;
  errors: number;
}

let vapidConfigured: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const pub = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? 'mailto:hello@notai.app';
  if (!pub || !priv) {
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(subj, pub, priv);
  vapidConfigured = true;
  return true;
}

/**
 * Fan-out a single push payload to every device the user has registered.
 * Web subs go via VAPID; mobile (ios/android) go via FCM. Subscriptions
 * that fail permanently (404/410, or FCM "unregistered") are pruned.
 * Never throws — returns counters so callers can log without try/catch.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, pruned: 0, errors: 0 };
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      platform: pushSubscriptions.platform,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return result;

  const hasVapid = ensureVapid();
  for (const sub of subs) {
    if (sub.platform === 'ios' || sub.platform === 'android') {
      const { sendFcm } = await import('./fcm');
      const r = await sendFcm(sub.endpoint, payload);
      if (r.ok) result.sent += 1;
      else if (r.permanent) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.pruned += 1;
      } else result.errors += 1;
      continue;
    }
    if (!hasVapid || !sub.p256dh || !sub.auth) {
      result.errors += 1;
      continue;
    }
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 60 * 60 },
      );
      result.sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.pruned += 1;
      } else {
        result.errors += 1;
      }
    }
  }
  return result;
}
