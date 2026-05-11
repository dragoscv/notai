'use server';

import { revalidatePath } from 'next/cache';
import { db, and, eq, webauthnCredentials } from '@notai/db';
import { auth } from '@/auth';

export async function deletePasskey(id: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await db
    .delete(webauthnCredentials)
    .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, session.user.id)));
  revalidatePath('/app/settings/security');
  return { ok: true };
}

export async function renamePasskey(id: string, label: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const trimmed = label.trim().slice(0, 64);
  if (trimmed.length === 0) return { ok: false };
  await db
    .update(webauthnCredentials)
    .set({ label: trimmed })
    .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, session.user.id)));
  revalidatePath('/app/settings/security');
  return { ok: true };
}
