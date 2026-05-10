#!/usr/bin/env node
/**
 * Generate a VAPID keypair for Web Push.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs
 *
 * Output is two base64url-encoded keys you set as
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 * The public key also goes into NEXT_PUBLIC_VAPID_PUBLIC_KEY so the
 * browser can subscribe.
 *
 * Uses Node's built-in `crypto` (no dependencies). The `web-push`
 * library accepts these keys verbatim.
 */
import { generateKeyPairSync, createPublicKey } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

// Raw uncompressed public key (65 bytes: 0x04 || X || Y).
const publicJwk = createPublicKey(publicKey).export({ format: 'jwk' });
const x = Buffer.from(publicJwk.x, 'base64url');
const y = Buffer.from(publicJwk.y, 'base64url');
const rawPublic = Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url');

const privateJwk = privateKey.export({ format: 'jwk' });
const rawPrivate = Buffer.from(privateJwk.d, 'base64url').toString('base64url');

console.log('# Add to .env.local and Vercel project env:');
console.log(`VAPID_PUBLIC_KEY=${rawPublic}`);
console.log(`VAPID_PRIVATE_KEY=${rawPrivate}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${rawPublic}`);
console.log(`VAPID_SUBJECT=mailto:hello@example.com`);
