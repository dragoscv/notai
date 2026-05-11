/**
 * E2E encryption primitives — WebCrypto only, no dependencies.
 *
 * Threat model: the server stores ciphertext + a KEK-wrapped master
 * key. The KEK is derived in the browser from the user's passphrase
 * via PBKDF2-SHA256 (600k iters by default), or from a 32-byte
 * recovery key generated at setup. We never transmit the passphrase
 * or the master key.
 *
 * Wire format for every wrapped value:
 *   base64( IV(12 bytes) || ciphertext )
 * AES-GCM authenticates the ciphertext; tampering causes `decrypt`
 * to throw.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** Generate a fresh 32-byte AES-GCM master key as a raw extractable CryptoKey. */
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** 32 random bytes formatted as `notai-rk-<base64url>` for the user to copy. */
export function generateRecoveryKey(): { raw: Uint8Array; display: string } {
  const raw = randomBytes(32);
  const display =
    'notai-rk-' + toB64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { raw, display };
}

export function parseRecoveryKey(display: string): Uint8Array {
  const cleaned = display.trim().replace(/^notai-rk-/i, '');
  const b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  return fromB64(b64);
}

/** PBKDF2-derive a 32-byte AES-GCM KEK from the passphrase. */
export async function deriveKEKFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iters: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: iters, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt'],
  );
}

/** Import the 32-byte recovery key as an AES-GCM KEK. */
export async function importRecoveryKEK(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey as unknown as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** AES-GCM encrypt arbitrary bytes; returns base64(iv || ct). */
export async function encryptBytes(key: CryptoKey, plain: Uint8Array): Promise<string> {
  const iv = randomBytes(12);
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    plain as unknown as ArrayBuffer,
  );
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toB64(out);
}

export async function decryptBytes(key: CryptoKey, payload: string): Promise<Uint8Array> {
  const all = fromB64(payload);
  const iv = all.slice(0, 12);
  const ct = all.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    ct as unknown as ArrayBuffer,
  );
  return new Uint8Array(plain);
}

export async function encryptString(key: CryptoKey, plain: string): Promise<string> {
  return encryptBytes(key, enc.encode(plain));
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const bytes = await decryptBytes(key, payload);
  return dec.decode(bytes);
}

/** Export an AES-GCM CryptoKey as 32 raw bytes (used to wrap it under a KEK). */
export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  const buf = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(buf);
}

export async function importRawAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as unknown as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export function randomSalt(n = 16): string {
  return toB64(randomBytes(n));
}

export { toB64, fromB64 };
