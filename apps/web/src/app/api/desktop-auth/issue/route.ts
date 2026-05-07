import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@notai/db/client';
import { verificationTokens } from '@notai/db/schema';

/**
 * Issues a short-lived handoff token for the Tauri desktop app.
 *
 * Flow:
 *   1. User signs in via the system browser (where they're already logged
 *      into Google).
 *   2. Auth.js redirects here as the callbackUrl.
 *   3. We mint a single-use token, persist it, and redirect the browser
 *      to `notai://auth?token=...` which the OS routes to the Tauri app.
 *   4. The desktop app navigates its own webview to `/api/desktop-auth/consume`
 *      to exchange the token for a real session cookie inside the webview.
 *
 * We reuse the `verification_token` table so no migration is required:
 *   identifier = raw handoff token  (lookup key)
 *   token      = userId
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.redirect(new URL('/signin', baseUrl()));
    }

    const handoff = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await db.insert(verificationTokens).values({
        identifier: `desktop-handoff:${handoff}`,
        token: session.user.id,
        expires,
    });

    // Show a small HTML page that triggers the deep link and gives the user
    // a manual fallback if their OS didn't hand off automatically.
    const deepLink = `notai://auth?token=${encodeURIComponent(handoff)}`;
    const html = `<!doctype html>
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

    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

function baseUrl() {
    return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';
}
