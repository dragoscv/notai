import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@notai/db/client';
import { verificationTokens } from '@notai/db/schema';

/**
 * Issues a short-lived handoff token for the Tauri desktop app.
 *
 * Flow (device pairing — no deep link):
 *   1. Desktop generates a random `device` code, opens the system browser at
 *      `/desktop-signin?device=<code>` and starts polling
 *      `/api/desktop-auth/poll?device=<code>` in the background.
 *   2. The browser signs in with Google via Auth.js, which redirects here
 *      with the device code preserved as a query param.
 *   3. We mint a single-use handoff token, store it under the device code
 *      so the polling endpoint can find it, and show a "you can close this
 *      tab" page. The browser never tries to launch `notai://`.
 *   4. The desktop app's poll picks up the token and navigates its own
 *      webview to `/api/desktop-auth/consume?token=...` which sets the
 *      session cookie inside the webview.
 *
 * We reuse the `verification_token` table so no migration is required:
 *   identifier = 'desktop-pair:<deviceCode>'  (lookup key — secret)
 *   token      = handoff token (single-use, also used by /consume)
 *
 * Legacy: when no `device` is provided we fall back to the old
 * `notai://auth?token=…` deep-link path so existing released apps that
 * haven't yet auto-updated keep working.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/signin', baseUrl(req)));
  }

  const device = req.nextUrl.searchParams.get('device');
  const handoff = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  if (device && device.length >= 16 && device.length <= 256) {
    // Device-pairing path: store under the device code, no deep link.
    await db.insert(verificationTokens).values({
      identifier: `desktop-pair:${device}`,
      token: handoff,
      expires,
    });
    // Also mint a row keyed by the handoff itself so the existing
    // /consume endpoint (which expects `desktop-handoff:<token>` →
    // userId) can validate it without changes.
    await db.insert(verificationTokens).values({
      identifier: `desktop-handoff:${handoff}`,
      token: session.user.id,
      expires,
    });
    return new NextResponse(closeTabHtml(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Legacy deep-link fallback for old desktop builds.
  await db.insert(verificationTokens).values({
    identifier: `desktop-handoff:${handoff}`,
    token: session.user.id,
    expires,
  });
  const deepLink = `notai://auth?token=${encodeURIComponent(handoff)}`;
  return new NextResponse(deepLinkHtml(deepLink), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function closeTabHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Signed in</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100dvh; margin: 0; background: #0b0b0f; color: #e5e5e5; }
    .card { max-width: 420px; padding: 2rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
    p  { margin: 0.5rem 0; opacity: 0.75; }
</style>
</head><body>
<div class="card">
    <h1>Signed in ✓</h1>
    <p>You can close this tab — Notai will pick it up automatically.</p>
</div>
<script>setTimeout(() => { try { window.close(); } catch {} }, 1500);</script>
</body></html>`;
}

function deepLinkHtml(deepLink: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Returning to Notai…</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100dvh; margin: 0; background: #0b0b0f; color: #e5e5e5; }
    .card { max-width: 420px; padding: 2rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
    p  { margin: 0.5rem 0; opacity: 0.75; }
    a  { color: #a78bfa; }
</style>
</head><body>
<div class="card">
    <h1>Signed in ✓</h1>
    <p>Opening Notai desktop…</p>
    <p><a href="${deepLink}">Click here if it didn't open automatically.</a></p>
    <p><small>You can close this tab.</small></p>
</div>
<script>location.replace(${JSON.stringify(deepLink)});</script>
</body></html>`;
}

function baseUrl(req: NextRequest) {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    req.nextUrl.origin
  );
}
