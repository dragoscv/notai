'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, eq, sql, users } from '@notai/db';
import { auth, signOut } from '@/auth';

const GRACE_DAYS = Number(process.env.ACCOUNT_DELETION_GRACE_DAYS ?? 30);

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

export async function requestAccountDeletion(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await db
    .update(users)
    .set({ deletionRequestedAt: sql`now()` })
    .where(eq(users.id, session.user.id));
  revalidatePath('/app/settings/security');
  // Sign the user out — they have to sign back in within the grace
  // window to cancel.
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
