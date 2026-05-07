/**
 * Token endpoint (RFC 6749 §3.2 + §6).
 *
 * Supported grant types:
 *   - authorization_code  (PKCE always required, OAuth 2.1)
 *   - refresh_token       (with rotation + replay-detection)
 */
import { TTL, compareSecret, parseScopes, type PkceMethod, verifyPkce } from '@notai/lib/oauth';
import {
  consumeToken,
  findActiveClientByClientId,
  findActiveTokenByHash,
  findTokenByHashAnyState,
  issueToken,
  oauthError,
  revokeTokenFamily,
} from '@/server/oauth-store';

export async function POST(req: Request) {
  const ctype = req.headers.get('content-type') ?? '';
  if (!ctype.includes('application/x-www-form-urlencoded')) {
    return oauthError('invalid_request', 'Expected application/x-www-form-urlencoded.');
  }
  const form = await req.formData();
  const grantType = String(form.get('grant_type') ?? '');

  const auth = parseClientAuth(req, form);
  if (!auth.clientId) {
    return oauthError('invalid_client', 'Missing client_id.', 401);
  }
  const client = await findActiveClientByClientId(auth.clientId);
  if (!client) return oauthError('invalid_client', 'Unknown client.', 401);

  if (client.type !== 'public') {
    if (!auth.clientSecret || !client.clientSecretHash) {
      return oauthError('invalid_client', 'client_secret required.', 401);
    }
    if (!compareSecret(auth.clientSecret, client.clientSecretHash)) {
      return oauthError('invalid_client', 'Bad client_secret.', 401);
    }
  }

  switch (grantType) {
    case 'authorization_code':
      return handleAuthCode(form, client.id, client.type === 'public');
    case 'refresh_token':
      return handleRefresh(form, client.id);
    default:
      return oauthError('unsupported_grant_type', `Grant type "${grantType}" is not supported.`);
  }
}

async function handleAuthCode(form: FormData, clientId: string, isPublic: boolean) {
  const code = String(form.get('code') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  const verifier = String(form.get('code_verifier') ?? '');

  if (!code) return oauthError('invalid_request', 'Missing code.');
  if (!redirectUri) return oauthError('invalid_request', 'Missing redirect_uri.');
  if (!verifier) return oauthError('invalid_request', 'Missing code_verifier.');

  const codeRow = await findActiveTokenByHash(code, 'authorization_code');
  if (!codeRow) return oauthError('invalid_grant', 'Code expired or already used.');
  if (codeRow.clientId !== clientId) {
    return oauthError('invalid_grant', 'Code was issued to a different client.');
  }
  if ((codeRow.redirectUri ?? '') !== redirectUri) {
    return oauthError('invalid_grant', 'redirect_uri does not match.');
  }
  if (!codeRow.codeChallenge) {
    // Should never happen — PKCE is required at /authorize.
    return oauthError('invalid_grant', 'Code missing PKCE challenge.');
  }
  const method = (codeRow.codeChallengeMethod as PkceMethod) ?? 'S256';
  if (!verifyPkce(verifier, codeRow.codeChallenge, method)) {
    return oauthError('invalid_grant', 'PKCE verification failed.');
  }

  await consumeToken(codeRow.id);
  const scopes = parseScopes(codeRow.scopes);

  const access = await issueToken({
    clientId,
    userId: codeRow.userId,
    kind: 'access_token',
    scopes,
    ttlSeconds: TTL.accessToken,
    familyId: codeRow.tokenFamilyId,
    metadata: codeRow.metadata as Record<string, unknown>,
  });
  const includeRefresh = scopes.includes('offline_access');
  const refresh = includeRefresh
    ? await issueToken({
        clientId,
        userId: codeRow.userId,
        kind: 'refresh_token',
        scopes,
        ttlSeconds: TTL.refreshToken,
        familyId: codeRow.tokenFamilyId,
      })
    : null;

  void isPublic; // public clients still get the same response
  return tokenResponse({
    access_token: access.token,
    expires_in: TTL.accessToken,
    scope: scopes.join(' '),
    refresh_token: refresh?.token,
  });
}

async function handleRefresh(form: FormData, clientId: string) {
  const raw = String(form.get('refresh_token') ?? '');
  if (!raw) return oauthError('invalid_request', 'Missing refresh_token.');

  const row = await findActiveTokenByHash(raw, 'refresh_token');
  if (!row || row.clientId !== clientId) {
    // Replay detection — if the token exists but is consumed/revoked, burn the family.
    const stale = await findTokenByHashAnyState(raw, 'refresh_token');
    if (stale?.tokenFamilyId) await revokeTokenFamily(stale.tokenFamilyId);
    return oauthError('invalid_grant', 'Refresh token invalid.');
  }

  const requested = parseScopes(String(form.get('scope') ?? row.scopes));
  const allowed = new Set(parseScopes(row.scopes));
  const scopes = requested.filter((s) => allowed.has(s));
  if (scopes.length === 0) return oauthError('invalid_scope');

  await consumeToken(row.id);
  const next = await issueToken({
    clientId,
    userId: row.userId,
    kind: 'refresh_token',
    scopes,
    ttlSeconds: TTL.refreshToken,
    familyId: row.tokenFamilyId,
  });
  const access = await issueToken({
    clientId,
    userId: row.userId,
    kind: 'access_token',
    scopes,
    ttlSeconds: TTL.accessToken,
    familyId: row.tokenFamilyId,
    metadata: row.metadata as Record<string, unknown>,
  });
  return tokenResponse({
    access_token: access.token,
    expires_in: TTL.accessToken,
    scope: scopes.join(' '),
    refresh_token: next.token,
  });
}

function parseClientAuth(req: Request, form: FormData) {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Basic ')) {
    try {
      const decoded = atob(authz.slice(6));
      const idx = decoded.indexOf(':');
      if (idx > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, idx)),
          clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
        };
      }
    } catch {
      // fall through
    }
  }
  return {
    clientId: String(form.get('client_id') ?? ''),
    clientSecret: form.has('client_secret') ? String(form.get('client_secret')) : null,
  };
}

interface TokenBody {
  access_token: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

function tokenResponse(body: TokenBody) {
  return new Response(JSON.stringify({ ...body, token_type: 'Bearer' }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
    },
  });
}
