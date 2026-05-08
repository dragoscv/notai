import { NextRequest, NextResponse } from 'next/server';
import { eq } from '@notai/db';
import { db } from '@notai/db/client';
import { verificationTokens } from '@notai/db/schema';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

/**
 * Background poll endpoint for the desktop pairing flow.
 *
 * The Tauri app generates a random `device` code, opens the system browser
 * for Google sign-in, and polls this endpoint every few seconds. As soon as
 * `/api/desktop-auth/issue` has stored a handoff token for this device, we
 * return it (single-use) and the desktop app navigates its webview to
 * `/api/desktop-auth/consume?token=...` to set the session cookie.
 *
 * No deep link, no `notai://` browser dialog — the browser tab just shows
 * "Signed in, you can close this tab".
 *
 * The desktop app holds the only copy of the device code, so polling is
 * safe: the handoff token is bound to that random 256-bit secret and
 * invalidated on first read.
 */
export async function GET(req: NextRequest) {
  const device = req.nextUrl.searchParams.get('device');
  if (!device || device.length < 16 || device.length > 256) {
    return NextResponse.json({ error: 'invalid-device' }, { status: 400 });
  }

  // Per-device rate limit. Legitimate desktop polls every ~2s for ~5
  // minutes (max 150 polls). 60 requests / 60s is plenty of headroom.
  // An attacker brute-forcing device codes against this endpoint will
  // hit the cap immediately.
  const rl = await rateLimit({
    name: 'desktop-poll',
    key: device,
    windowSec: 60,
    max: 60,
  });
  if (!rl.ok) return tooManyRequests(rl);

  const identifier = `desktop-pair:${device}`;
  const now = new Date();

  const [row] = await db
    .select({
      handoff: verificationTokens.token,
      expires: verificationTokens.expires,
    })
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier))
    .limit(1);

  if (!row) {
    return NextResponse.json({ status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Single-use: delete before returning, even if expired.
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));

  if (row.expires <= now) {
    return NextResponse.json({ status: 'expired' }, { status: 410 });
  }

  return NextResponse.json(
    { status: 'ready', token: row.handoff },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
