import 'server-only';
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { db, webauthnCredentials } from '@notai/db';
import { auth } from '@/auth';
import { consumeChallengeCookie, getRpConfig } from '@/server/webauthn';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const body = (await req.json()) as { response: RegistrationResponseJSON; label?: string };
  const blob = await consumeChallengeCookie();
  if (!blob || blob.u !== userId) {
    return NextResponse.json({ error: 'no_challenge' }, { status: 400 });
  }

  const { rpID, origin } = getRpConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: blob.c,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'verify_failed', detail: (err as Error).message },
      { status: 400 },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'not_verified' }, { status: 400 });
  }
  const info = verification.registrationInfo;
  const cred = info.credential;

  const label =
    typeof body.label === 'string' && body.label.trim().length > 0
      ? body.label.trim().slice(0, 64)
      : null;

  await db.insert(webauthnCredentials).values({
    userId,
    credentialId: cred.id,
    publicKey: cred.publicKey,
    counter: cred.counter,
    transports: cred.transports?.join(',') ?? null,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    label,
  });

  return NextResponse.json({ ok: true });
}
