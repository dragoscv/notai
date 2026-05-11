import 'server-only';
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRpConfig, setChallengeCookie } from '@/server/webauthn';

export const runtime = 'nodejs';

export async function POST() {
  const { rpID } = getRpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: [], // discoverable credential / resident key
  });
  await setChallengeCookie(options.challenge, null);
  return NextResponse.json(options);
}
