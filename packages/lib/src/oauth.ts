/**
 * OAuth 2.1 / OIDC primitives — pure functions, no I/O.
 *
 * Spec compliance:
 *   - RFC 6749 (OAuth 2.0) + draft OAuth 2.1
 *   - RFC 7636 (PKCE) — REQUIRED for all clients in 2.1
 *   - RFC 7009 (Token revocation)
 *   - RFC 7591 (Dynamic Client Registration)
 *   - RFC 8414 (Authorization Server Metadata)
 *   - RFC 9728 (Protected Resource Metadata, for MCP)
 *   - MCP 2025-06-18 Authorization spec
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Scopes notai understands. */
export const KNOWN_SCOPES = [
  // OIDC identity
  'openid',
  'profile',
  'email',
  // Long-lived access (request refresh token)
  'offline_access',
  // Note primitives
  'notes:read',
  'notes:write',
  'notes:delete',
  // Folder primitives
  'folders:read',
  'folders:write',
  // MCP umbrella scope
  'mcp',
] as const;

export type Scope = (typeof KNOWN_SCOPES)[number] | (string & {});

export const DEFAULT_SCOPES: readonly Scope[] = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'notes:read',
  'notes:write',
  'mcp',
];

export function parseScopes(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function formatScopes(scopes: readonly string[]): string {
  return [...new Set(scopes)].join(' ');
}

/** Intersect requested scopes against allowed (client + user-consented). */
export function intersectScopes(requested: string, allowed: string): string[] {
  const allow = new Set(parseScopes(allowed));
  return parseScopes(requested).filter((s) => allow.has(s));
}

/** Every requested scope must be in `granted`. */
export function scopesCovered(requested: readonly string[], granted: readonly string[]): boolean {
  const set = new Set(granted);
  return requested.every((s) => set.has(s));
}

// ─── Token generation + hashing ──────────────────────────────────────────

const PREFIX = {
  authorization_code: 'notai_ac_',
  access_token: 'notai_at_',
  refresh_token: 'notai_rt_',
  registration: 'notai_reg_',
  client_secret: 'notai_cs_',
} as const;

export type TokenKindPrefix = keyof typeof PREFIX;

export function tokenPrefix(kind: TokenKindPrefix): string {
  return PREFIX[kind];
}

/** Cryptographically random URL-safe string (base64url, 32 bytes ≈ 43 chars). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function generateClientId(): string {
  return `notai_app_${randomBytes(12).toString('base64url')}`;
}

export function generateClientSecret(): string {
  return PREFIX.client_secret + randomToken(32);
}

/** sha256(value) → base64url. Stable storage form for tokens & secrets. */
export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

/** Constant-time hash compare. */
export function compareSecret(presented: string, hash: string): boolean {
  const candidate = hashToken(presented);
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── PKCE (RFC 7636) ─────────────────────────────────────────────────────

export type PkceMethod = 'S256' | 'plain';

export function verifyPkce(
  verifier: string,
  challenge: string,
  method: PkceMethod = 'S256',
): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9._~-]+$/.test(verifier)) return false;
  if (method === 'plain') return verifier === challenge;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return computed === challenge;
}

// ─── TTLs ────────────────────────────────────────────────────────────────

export const TTL = {
  authorizationCode: 60, // 1 minute
  accessToken: 60 * 60, // 1 hour
  refreshToken: 60 * 60 * 24 * 30, // 30 days
} as const;

export function expiresIn(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

// ─── Errors (RFC 6749 §5.2) ──────────────────────────────────────────────

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error'
  | 'temporarily_unavailable'
  | 'invalid_token'
  | 'insufficient_scope';
