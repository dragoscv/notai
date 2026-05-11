'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import {
  startTotpEnrollment as start,
  finishTotpEnrollment as finish,
  disableTotp as disable,
  verifyTotp,
} from '@/server/totp';

type OkOnly = { ok: true };
type Err = { ok: false; error: string };

export async function beginTotpEnrollment(): Promise<
  { ok: true; otpauthUrl: string; qrDataUrl: string } | Err
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'unauthenticated' };
  const draft = await start(session.user.id, session.user.email ?? session.user.id);
  return { ok: true, otpauthUrl: draft.otpauthUrl, qrDataUrl: draft.qrDataUrl };
}

export async function confirmTotpEnrollment(
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | Err> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'unauthenticated' };
  const r = await finish(session.user.id, code);
  if (!r.ok) return { ok: false, error: r.error ?? 'Invalid code' };
  revalidatePath('/app/settings/security');
  return { ok: true, recoveryCodes: r.recoveryCodes ?? [] };
}

export async function disableTotpAction(code: string): Promise<OkOnly | Err> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'unauthenticated' };
  const r = await disable(session.user.id, code);
  if (!r.ok) return { ok: false, error: r.error ?? 'Invalid code' };
  revalidatePath('/app/settings/security');
  return { ok: true };
}

export async function stepUpAction(code: string): Promise<OkOnly | Err> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'unauthenticated' };
  const r = await verifyTotp(session.user.id, code);
  if (!r.ok) return { ok: false, error: 'Invalid code' };
  return { ok: true };
}
