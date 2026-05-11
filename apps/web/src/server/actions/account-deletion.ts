'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, eq, sql, users } from '@notai/db';
import { auth, signOut } from '@/auth';
import { hasFreshStepUp, verifyTotp } from '@/server/totp';

const GRACE_DAYS = Number(process.env.ACCOUNT_DELETION_GRACE_DAYS ?? 30);
const STEP_UP_WINDOW_SECONDS = 5 * 60;

export async function getDeletionStatus(): Promise<{
  requestedAt: string | null;
  graceDays: number;
  purgesAt: string | null;
}> {
  const session = await auth();
  if (!session?.user?.id) return { requestedAt: null, graceDays: GRACE_DAYS, purgesAt: null };
  const u = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { deletionRequestedAt: true },
  });
  const at = u?.deletionRequestedAt ?? null;
  const purgesAt = at ? new Date(at.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000) : null;
  return {
    requestedAt: at?.toISOString() ?? null,
    graceDays: GRACE_DAYS,
    purgesAt: purgesAt?.toISOString() ?? null,
  };
}

export async function requestAccountDeletion(
  totpCode?: string,
): Promise<{ ok: boolean; stepUpRequired?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'unauthenticated' };

  // If the user has TOTP enrolled, require a fresh step-up. The UI may
  // pass a `totpCode` to satisfy it inline.
  const fresh = await hasFreshStepUp(session.user.id, STEP_UP_WINDOW_SECONDS);
  if (!fresh) {
    if (!totpCode) return { ok: false, stepUpRequired: true };
    const v = await verifyTotp(session.user.id, totpCode);
    if (!v.ok) return { ok: false, stepUpRequired: true, error: 'Invalid code' };
  }

  await db
    .update(users)
    .set({ deletionRequestedAt: sql`now()` })
    .where(eq(users.id, session.user.id));
  revalidatePath('/app/settings/security');
  await signOut({ redirectTo: '/' });
  return { ok: true };
}

export async function cancelAccountDeletion(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await db.update(users).set({ deletionRequestedAt: null }).where(eq(users.id, session.user.id));
  revalidatePath('/app/settings/security');
  return { ok: true };
}

/** Cron: hard-delete users whose deletion request is past the grace window. */
export async function purgePendingDeletions(): Promise<{ purged: number; graceDays: number }> {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  // CASCADE on `accounts.user_id`, `sessions.user_id`, `notes.owner_id` etc
  // handles the rest. Returning rows so we can audit how many were purged.
  const deleted = await db
    .delete(users)
    .where(
      sql`${users.deletionRequestedAt} is not null and ${users.deletionRequestedAt} < ${cutoff}`,
    )
    .returning({ id: users.id });
  return { purged: deleted.length, graceDays: GRACE_DAYS };
}

// Used by /signin to bounce a user who logs in mid-grace into the
// "cancel deletion?" UI before letting them back to /app.
export async function bounceIfDeletionPending() {
  const status = await getDeletionStatus();
  if (status.requestedAt) redirect('/app/settings/security?deletion=pending');
}
