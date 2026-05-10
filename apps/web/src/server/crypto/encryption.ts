import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Server-side AES-256-GCM helper for encrypting note bodies and other
 * sensitive blobs at rest.
 *
 * Layout of a ciphertext blob (base64url):
 *   [ 1 byte version ] [ 12 bytes IV ] [ 16 bytes auth tag ] [ N bytes ciphertext ]
 *
 * The master key comes from `NOTAI_DATA_KEY` (base64-encoded 32 bytes).
 * If the env var is missing we throw on use \u2014 callers gate on
 * `isEncryptionConfigured()` so the migration can be opt-in.
 *
 * For per-user data keys (workspace boundary), wrap the user key with
 * the master key using `wrapKey` / `unwrapKey` and store the wrapped
 * blob alongside the user record.
 */

const VERSION = 0x01;

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.NOTAI_DATA_KEY);
}

function masterKey(): Buffer {
  const raw = process.env.NOTAI_DATA_KEY;
  if (!raw) throw new Error('NOTAI_DATA_KEY is not configured');
  // Accept either raw base64 (32 bytes) or a passphrase we KDF down.
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 32) return buf;
  // Fallback: derive a key from the string. Salt is constant per
  // deployment so the key is stable; rotate by changing NOTAI_DATA_KEY.
  return scryptSync(raw, 'notai-data-key-v1', 32);
}

export function encrypt(plaintext: string | Buffer): string {
  const key = masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]).toString('base64url');
}

export function decrypt(blob: string): Buffer {
  const buf = Buffer.from(blob, 'base64url');
  if (buf[0] !== VERSION) throw new Error('Unsupported ciphertext version');
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const enc = buf.subarray(29);
  const key = masterKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function decryptToString(blob: string): string {
  return decrypt(blob).toString('utf8');
}

/** Wrap a per-resource data key with the master key. */
export function wrapKey(dataKey: Buffer): string {
  return encrypt(dataKey);
}

export function unwrapKey(wrapped: string): Buffer {
  return decrypt(wrapped);
}

/** Generate a fresh 32-byte data key suitable for AES-256-GCM. */
export function generateDataKey(): Buffer {
  return randomBytes(32);
}
