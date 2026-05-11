import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendPushToUser } from '@/server/push/dispatch';

export const runtime = 'nodejs';

/**
 * Send a test push to the signed-in user's registered devices. Useful from
 * the /app/settings/notifications page to confirm a subscription works
 * end-to-end without waiting for the daily-review cron.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await sendPushToUser(session.user.id, {
    title: 'Notai test push',
    body: 'If you see this, push is working on this device.',
    url: '/app',
    tag: 'notai-test',
  });
  return NextResponse.json(result);
}
