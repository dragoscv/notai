/**
 * Tiny S3-compatible client (no SDK). Speaks both Cloudflare R2 and any
 * other S3-compatible blob store (Backblaze B2 / Wasabi / GCS HMAC).
 *
 * Why hand-rolled? The official AWS SDK is ~3 MB and we only need:
 *   - presign PUT for direct uploads,
 *   - GET signed URL for serving,
 *   - DELETE for revoke.
 *
 * Implements SigV4 query-signed URLs which work across every S3-compatible
 * provider. Set ASSETS_PROVIDER, ASSETS_BUCKET, ASSETS_ENDPOINT,
 * ASSETS_REGION, ASSETS_ACCESS_KEY_ID, ASSETS_SECRET_ACCESS_KEY,
 * ASSETS_PUBLIC_BASE_URL.
 */

import { createHash, createHmac } from 'node:crypto';

interface Env {
  bucket: string;
  endpoint: string; // e.g. https://<accountid>.r2.cloudflarestorage.com
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string; // Optional CDN origin for served assets
}

function readEnv(): Env | null {
  const bucket = process.env.ASSETS_BUCKET;
  const endpoint = process.env.ASSETS_ENDPOINT;
  const region = process.env.ASSETS_REGION ?? 'auto';
  const accessKeyId = process.env.ASSETS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ASSETS_SECRET_ACCESS_KEY;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    endpoint: endpoint.replace(/\/+$/, ''),
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.ASSETS_PUBLIC_BASE_URL,
  };
}

export function isAssetsConfigured(): boolean {
  return readEnv() !== null;
}

function hmac(key: Buffer | string, data: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function amzDate(d: Date): { full: string; date: string } {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const full = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return { full, date: full.slice(0, 8) };
}

function rfc3986(s: string) {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

interface SignArgs {
  method: 'PUT' | 'GET' | 'DELETE';
  key: string;
  contentType?: string;
  expiresInSeconds: number;
}

/** Returns a presigned URL for the given operation. */
export function presign({ method, key, expiresInSeconds, contentType }: SignArgs): string {
  const env = readEnv();
  if (!env) throw new Error('Assets storage not configured');

  const url = new URL(`${env.endpoint}/${env.bucket}/${rfc3986(key).replace(/%2F/g, '/')}`);
  const host = url.host;
  const now = new Date();
  const { full, date } = amzDate(now);
  const credentialScope = `${date}/${env.region}/s3/aws4_request`;
  const credential = `${env.accessKeyId}/${credentialScope}`;
  const algorithm = 'AWS4-HMAC-SHA256';

  const params: Record<string, string> = {
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': credential,
    'X-Amz-Date': full,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  if (method === 'PUT' && contentType) {
    // Signed-only header is host; ContentType travels as ordinary header
    // and is not part of canonical request when using "UNSIGNED-PAYLOAD".
  }

  const queryKeys = Object.keys(params).sort();
  const canonicalQuery = queryKeys.map((k) => `${rfc3986(k)}=${rfc3986(params[k]!)}`).join('&');

  const canonicalUri = url.pathname.split('/').map((p) => rfc3986(decodeURIComponent(p))).join('/');
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [algorithm, full, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${env.secretAccessKey}`, date);
  const kRegion = hmac(kDate, env.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return url.toString();
}

export function publicUrlFor(key: string): string {
  const env = readEnv();
  if (!env) throw new Error('Assets storage not configured');
  if (env.publicBaseUrl) return `${env.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  // Fallback: presigned GET valid for 7 days (max for SigV4).
  return presign({ method: 'GET', key, expiresInSeconds: 60 * 60 * 24 * 7 });
}

export interface UploadKey {
  noteId: string;
  ownerId: string;
  filename: string;
  mime: string;
}

/** Builds a stable storage key. Folders by user + note keep ACL queries cheap. */
export function buildKey({ noteId, ownerId, filename }: UploadKey): string {
  const safe = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 100);
  const stamp = Date.now();
  return `u/${ownerId}/n/${noteId}/${stamp}-${safe}`;
}
