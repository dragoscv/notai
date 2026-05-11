'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, desc, emailSuppressions } from '@notai/db';
import { requireAdmin } from '@/server/rbac';
import { addSuppression, removeSuppression } from '@/server/email-suppressions';

const emailSchema = z.string().email().max(254);

export async function listSuppressions(limit = 200) {
  await requireAdmin();
  const cap = Math.min(Math.max(limit, 1), 500);
  return db
    .select({
      email: emailSuppressions.email,
      reason: emailSuppressions.reason,
      source: emailSuppressions.source,
      detail: emailSuppressions.detail,
      createdAt: emailSuppressions.createdAt,
    })
    .from(emailSuppressions)
    .orderBy(desc(emailSuppressions.createdAt))
    .limit(cap);
}

export async function adminAddSuppression(email: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: 'Invalid email' };
  await addSuppression({
    email: parsed.data,
    reason: 'manual',
    source: 'admin',
    detail: 'added by admin',
  });
  revalidatePath('/admin/email-suppressions');
  return { ok: true };
}

export async function adminRemoveSuppression(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: 'Invalid email' };
  await removeSuppression(parsed.data);
  revalidatePath('/admin/email-suppressions');
  return { ok: true };
}
