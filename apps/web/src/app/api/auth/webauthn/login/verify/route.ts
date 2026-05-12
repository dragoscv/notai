import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { db, eq, sql, webauthnCredentials } from '@notai/db';
import { consumeChallengeCookie, createSessionForUser, getRpConfig } from '@/server/webauthn';
import { getClientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limit = await rateLimit({
    name: 'webauthn-login-verify',
    key: getClientIp(req),
    windowSec: 60,
    max: 10,
  });
  if (!limit.ok) return tooManyRequests(limit);
  const body = (await req.json()) as { response: AuthenticationResponseJSON };
  const blob = await consumeChallengeCookie();
  if (!blob) return NextResponse.json({ error: 'no_challenge' }, { status: 400 });
  if (blob.u !== null) return NextResponse.json({ error: 'wrong_flow' }, { status: 400 });

  const credentialID = body.response?.id;
  if (typeof credentialID !== 'string' || credentialID.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const cred = await db.query.webauthnCredentials.findFirst({
    where: eq(webauthnCredentials.credentialId, credentialID),
  });
  if (!cred) return NextResponse.json({ error: 'unknown_credential' }, { status: 401 });

  const { rpID, origin } = getRpConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: blob.c,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        // copy into a fresh Uint8Array<ArrayBuffer> to satisfy the strict
        // variance check in @simplewebauthn/server's typings
        publicKey: new Uint8Array(cred.publicKey),
        counter: cred.counter,
        transports: (cred.transports?.split(',').filter(Boolean) ?? undefined) as
          | AuthenticatorTransport[]
          | undefined,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'verify_failed', detail: (err as Error).message },
      { status: 401 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'not_verified' }, { status: 401 });
  }

  // Counter regression = possible cloned authenticator. Reject.
  if (verification.authenticationInfo.newCounter < cred.counter) {
    return NextResponse.json({ error: 'counter_regression' }, { status: 401 });
  }

  await db
    .update(webauthnCredentials)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: sql`now()`,
    })
    .where(eq(webauthnCredentials.id, cred.id));

  await createSessionForUser(cred.userId);
  return NextResponse.json({ ok: true });
}

type AuthenticatorTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid';
