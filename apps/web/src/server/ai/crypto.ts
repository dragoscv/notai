import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { env } from '@notai/lib';

/**
 * AES-256-GCM symmetric encryption for at-rest user secrets (BYOK).
 *
 * Key resolution order:
 *   1. SECRETS_ENCRYPTION_KEY (32 raw bytes, base64-encoded) — preferred
 *      for production so you can rotate independently of AUTH_SECRET.
 *   2. HKDF-SHA256(AUTH_SECRET, salt='notai/secrets/v1') — sensible default
 *      so dev / self-hosters don't need a second secret. Rotating
 *      AUTH_SECRET WILL invalidate stored secrets.
 *
 * Output format (base64): iv(12) || authTag(16) || ciphertext.
 */
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = process.env.SECRETS_ENCRYPTION_KEY;
  if (explicit) {
    const buf = Buffer.from(explicit, 'base64');
    if (buf.length !== 32) {
      throw new Error(
        'SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 raw bytes).',
      );
    }
    cachedKey = buf;
    return buf;
  }
  // Derive from AUTH_SECRET. Both are server-only so this is safe.
  const ikm = Buffer.from(env.AUTH_SECRET, 'utf8');
  const salt = createHash('sha256').update('notai/secrets/v1').digest();
  const derived = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('user-secrets'), 32) as ArrayBuffer,
  );
  cachedKey = derived;
  return derived;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(ciphertextB64: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, 'base64');
  if (buf.length < 12 + 16 + 1) throw new Error('Ciphertext too short.');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/** Mask helper for showing the last 4 chars of a key in the UI. */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
