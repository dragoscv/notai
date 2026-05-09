'use server';

import { auth } from '@/auth';
import { db, users, eq } from '@notai/db';

const IANA_RE = /^[A-Za-z_]+(?:\/[A-Za-z_+\-0-9]+){0,2}$/;

/**
 * Persist the browser-detected IANA timezone for the current user.
 * Called once per session by `<TimezoneSync>` if `users.timezone`
 * differs from the browser value. Cheap and idempotent.
 *
 * We validate the string client-side AND server-side because timezone
 * names land in date arithmetic (`Intl.DateTimeFormat` will throw on
 * invalid input), and we don't want to corrupt the cron job.
 */
export async function setUserTimezone(tz: string): Promise<{ ok: true } | { ok: false }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  const trimmed = (tz ?? '').trim();
  if (!trimmed || trimmed.length > 64 || !IANA_RE.test(trimmed)) return { ok: false };

  // Round-trip through Intl to confirm Node accepts it.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(new Date());
  } catch {
    return { ok: false };
  }

  await db.update(users).set({ timezone: trimmed }).where(eq(users.id, session.user.id));
  return { ok: true };
}
