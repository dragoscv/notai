#!/usr/bin/env node
/**
 * Generate a fresh ES256 (P-256) signing key for the OIDC id_token
 * pipeline. Print the private JWK on stdout — paste it into
 * `OIDC_SIGNING_KEY_JWK` (Vercel project env / .env.local) and redeploy.
 *
 *   node scripts/generate-oidc-key.mjs
 *   node scripts/generate-oidc-key.mjs --kid 2026-05-01
 *
 * The public half is published automatically at /.well-known/jwks.json
 * (cache TTL 5 min). Uses Node's WebCrypto; no extra deps required.
 */
import { webcrypto } from 'node:crypto';

const args = process.argv.slice(2);
let kid = new Date().toISOString().slice(0, 10);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--kid' && args[i + 1]) {
    kid = args[i + 1];
    i++;
  }
}

const keyPair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const jwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
const out = { ...jwk, alg: 'ES256', use: 'sig', kid };
process.stdout.write(JSON.stringify(out) + '\n');
