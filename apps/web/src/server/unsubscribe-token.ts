import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'unsubscribe';

function getSecret(): string {
  return process.env.AUTH_SECRET ?? process.env.HOCUSPOCUS_JWT_SECRET ?? 'dev-only-fallback';
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(`${PURPOSE}.${payload}`).digest('base64url');
}

export function makeUnsubscribeToken(email: string): string {
  const e = email.trim().toLowerCase();
  const body = Buffer.from(e, 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const i = token.indexOf('.');
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}
