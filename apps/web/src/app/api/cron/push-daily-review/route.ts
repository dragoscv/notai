import { NextResponse } from 'next/server';
import webpush from 'web-push';
import {
  db,
  pushSubscriptions,
  notes,
  users,
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  sql,
} from '@notai/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily review push fan-out. Vercel Cron should hit this once per
 * morning (e.g. 13:00 UTC). For each subscription we send a small
 * payload pointing at /app, customized with the user's count of
 * stale-todo notes from the last day. Subscriptions returning 404 or
 * 410 are pruned (they're permanently gone).
 *
 * Auth: requires `CRON_SECRET` either as `?secret=` or
 * `Authorization: Bearer ...` header (matches Vercel Cron config).
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:hello@notai.app';
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ skipped: 'vapid keys not configured' }, { status: 200 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // Group subscriptions by user so we send a single payload per user.
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      platform: pushSubscriptions.platform,
    })
    .from(pushSubscriptions);

  const result = { sent: 0, pruned: 0, errors: 0 };
  const seenUsers = new Map<string, { name: string | null; pendingCount: number }>();

  for (const sub of subs) {
    let info = seenUsers.get(sub.userId);
    if (!info) {
      const [u] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, sub.userId))
        .limit(1);
      const [c] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(
          and(
            eq(notes.ownerId, sub.userId),
            isNull(notes.deletedAt),
            isNotNull(notes.lastOpenedAt),
          ),
        )
        .orderBy(desc(notes.lastOpenedAt))
        .limit(1);
      info = { name: u?.name ?? null, pendingCount: c?.count ?? 0 };
      seenUsers.set(sub.userId, info);
    }

    const title = 'Your daily review is ready';
    const body = info.name
      ? `${info.name.split(' ')[0]}, take 2 minutes to review what you opened recently.`
      : 'Take 2 minutes to review your recent notes.';

    if (sub.platform === 'ios' || sub.platform === 'android') {
      // Native mobile token — FCM. Lazy import so dev environments without
      // Firebase env vars still successfully build the route.
      const { sendFcm } = await import('@/server/push/fcm');
      const r = await sendFcm(sub.endpoint, {
        title,
        body,
        url: '/app',
        tag: 'notai-daily',
      });
      if (r.ok) {
        result.sent += 1;
      } else if (r.permanent) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.pruned += 1;
      } else {
        result.errors += 1;
      }
      continue;
    }

    // Web push (VAPID). Skip rows that somehow lost their key pair.
    if (!sub.p256dh || !sub.auth) {
      result.errors += 1;
      continue;
    }
    const payload = JSON.stringify({
      title,
      body,
      url: '/app',
      tag: 'notai-daily',
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
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
  return NextResponse.json(result);
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev-friendly: allow when no secret set
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === expected) return true;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${expected}`;
}
