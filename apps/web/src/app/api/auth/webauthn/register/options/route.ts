import 'server-only';
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { db, eq, webauthnCredentials } from '@notai/db';
import { auth } from '@/auth';
import { getRpConfig, setChallengeCookie } from '@/server/webauthn';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { rpID, rpName } = getRpConfig();
  const userId = session.user.id;

  const existing = await db
    .select({ id: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: session.user.email ?? userId,
    userDisplayName: session.user.name ?? session.user.email ?? 'Notai user',
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: (c.transports?.split(',').filter(Boolean) ?? []) as AuthenticatorTransport[],
    })),
  });

  await setChallengeCookie(options.challenge, userId);
  return NextResponse.json(options);
}

type AuthenticatorTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid';
