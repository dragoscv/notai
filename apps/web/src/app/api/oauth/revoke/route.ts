/**
 * Token revocation (RFC 7009).
 *
 * Always returns 200 even when the token doesn't exist — required by
 * the spec to avoid leaking which tokens are still active.
 */
import { db, eq, oauthTokens } from '@notai/db';
import { compareSecret, hashToken } from '@notai/lib/oauth';
import { findActiveClientByClientId, oauthError } from '@/server/oauth-store';

export async function POST(req: Request) {
  const ctype = req.headers.get('content-type') ?? '';
  if (!ctype.includes('application/x-www-form-urlencoded')) {
    return oauthError('invalid_request', 'Expected application/x-www-form-urlencoded.');
  }
  const form = await req.formData();
  const tokenRaw = String(form.get('token') ?? '');
  if (!tokenRaw) return oauthError('invalid_request', 'Missing token.');

  const clientId = String(form.get('client_id') ?? '');
  const clientSecret = form.has('client_secret') ? String(form.get('client_secret')) : null;
  const client = await findActiveClientByClientId(clientId);
  if (!client) return oauthError('invalid_client', undefined, 401);

  if (client.type !== 'public') {
    if (!clientSecret || !client.clientSecretHash) {
      return oauthError('invalid_client', 'Secret required.', 401);
    }
    if (!compareSecret(clientSecret, client.clientSecretHash)) {
      return oauthError('invalid_client', undefined, 401);
    }
  }

  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(eq(oauthTokens.tokenHash, hashToken(tokenRaw)));

  return new Response('', { status: 200 });
}
