import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { db, sessions } from '@notai/db';

/** Read RP (Relying Party) configuration from env. */
export function getRpConfig() {
  const url = process.env.WEBAUTHN_ORIGIN ?? process.env.NEXTAUTH_URL ?? 'http://localhost:15600';
  const u = new URL(url);
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? u.hostname,
    rpName: 'Notai',
    origin: u.origin,
  };
}

const CHAL_COOKIE = 'notai_webauthn_chal';
const CHAL_TTL_MS = 5 * 60 * 1000; // 5 min

interface ChallengeBlob {
  c: string; // base64url challenge
  e: number; // expiresAt epoch ms
  /** Bound user id for registration; null for sign-in (discoverable) */
  u: string | null;
}

export async function setChallengeCookie(challenge: string, userId: string | null) {
  const blob: ChallengeBlob = { c: challenge, e: Date.now() + CHAL_TTL_MS, u: userId };
  const cookieStore = await cookies();
  cookieStore.set(CHAL_COOKIE, Buffer.from(JSON.stringify(blob)).toString('base64url'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 5 * 60,
  });
}

export async function consumeChallengeCookie(): Promise<ChallengeBlob | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CHAL_COOKIE)?.value;
  // Always clear, even on failure, to avoid replay.
  cookieStore.delete(CHAL_COOKIE);
  if (!raw) return null;
  try {
    const blob = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as ChallengeBlob;
    if (typeof blob.c !== 'string' || typeof blob.e !== 'number') return null;
    if (Date.now() > blob.e) return null;
    return blob;
  } catch {
    return null;
  }
}

const SESSION_TTL_DAYS = 7;

/**
 * Create an Auth.js v5 database session for the given user and set the
 * session cookie. Mirrors the DrizzleAdapter session shape so a normal
 * `auth()` call recognizes the session.
 */
export async function createSessionForUser(userId: string): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });
  const cookieStore = await cookies();
  cookieStore.set(isProd ? '__Secure-authjs.session-token' : 'authjs.session-token', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    expires,
  });
  // touch lastSeenAt is best-effort and handled elsewhere by middleware.
  void userId;
}

/** Generate cryptographically strong challenge bytes, base64url. */
export function newChallengeB64Url(): string {
  return randomBytes(32).toString('base64url');
}
