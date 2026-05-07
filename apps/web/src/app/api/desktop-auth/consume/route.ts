import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq } from '@notai/db';
import { db } from '@notai/db/client';
import { sessions, verificationTokens } from '@notai/db/schema';

/**
 * Consume a desktop handoff token inside the Tauri webview.
 *
 * - Looks up the token in `verification_token` where
 *   identifier = 'desktop-handoff:<rawToken>' and token = <userId>.
 * - Atomically deletes it (single use).
 * - Creates a real Auth.js database session for that user.
 * - Sets the `authjs.session-token` cookie on the webview and
 *   redirects to /app.
 */
export async function GET(req: NextRequest) {
  const handoff = req.nextUrl.searchParams.get('token');
  if (!handoff) return redirectToSignin(req, 'missing-token');

  const identifier = `desktop-handoff:${handoff}`;
  const now = new Date();

  // Look up the token.
  const [row] = await db
    .select({ userId: verificationTokens.token, expires: verificationTokens.expires })
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier))
    .limit(1);

  // Always delete (single use), even if expired.
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));

  if (!row || row.expires <= now) return redirectToSignin(req, 'invalid-or-expired');
  const userId = row.userId;

  // Mint a fresh database session (30 days, same as Auth.js default).
  const sessionToken = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });

  const useSecure = req.nextUrl.protocol === 'https:';
  const cookieName = useSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

  const res = NextResponse.redirect(new URL('/app', req.nextUrl.origin));
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecure,
    expires,
  });
  return res;
}

function redirectToSignin(req: NextRequest, reason: string) {
  const url = new URL('/signin', req.nextUrl.origin);
  url.searchParams.set('error', reason);
  return NextResponse.redirect(url);
}
