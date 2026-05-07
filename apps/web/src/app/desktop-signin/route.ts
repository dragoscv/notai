import { signIn } from '@/auth';

/**
 * Desktop sign-in entry point.
 *
 * The Tauri app shells out to the system browser at this URL because Google
 * blocks OAuth inside embedded WebView2. We immediately kick off the Auth.js
 * Google flow so the user lands on Google's consent screen instead of
 * bouncing through the regular `/signin` page first.
 *
 * After Google → Auth.js callback succeeds, we redirect to
 * `/api/desktop-auth/issue` which mints the short-lived handoff token and
 * sends the browser to `notai://auth?token=…` to hand off back into Tauri.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const callbackUrl = url.searchParams.get('callbackUrl') ?? '/api/desktop-auth/issue';
  await signIn('google', { redirectTo: callbackUrl });
}
