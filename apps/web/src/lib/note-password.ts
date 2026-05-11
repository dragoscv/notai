import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * scrypt password hashing for note-level / share-link locks. Format
 * is `scrypt$N$saltHex$hashHex` so we can rotate `N` later without a
 * schema change. Everything stays sync — Node's scryptSync is fast
 * enough at N=16384 (a few ms on modern hardware) and avoids juggling
 * a Promise in code paths that already do disk I/O.
 */
const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;

export function hashNotePassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyNotePassword(stored: string, password: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const nStr = parts[1] ?? '';
  const saltHex = parts[2] ?? '';
  const hashHex = parts[3] ?? '';
  const N = Number(nStr);
  if (!Number.isFinite(N) || N <= 0) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length === 0) return false;
  const derived = scryptSync(password, salt, expected.length, { N });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
