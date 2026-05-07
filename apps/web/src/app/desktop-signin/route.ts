import { signIn } from '@/auth';

/**
 * Desktop sign-in entry point.
 *
 * The Tauri app shells out to the system browser at this URL because Google
 * blocks OAuth inside embedded WebView2. We immediately kick off the Auth.js
 * Google flow so the user lands on Google's consent screen instead of
 * bouncing through the regular `/signin` page first.
 *
 * The optional `device` query param is forwarded into the post-auth
 * callback so `/api/desktop-auth/issue` can store the handoff token under
 * the device code, which the desktop app polls in the background. No deep
 * link / `notai://` round-trip is needed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const device = url.searchParams.get('device');
  const base = url.searchParams.get('callbackUrl') ?? '/api/desktop-auth/issue';
  const callbackUrl = device
    ? `${base}${base.includes('?') ? '&' : '?'}device=${encodeURIComponent(device)}`
    : base;
  await signIn('google', { redirectTo: callbackUrl });
}
