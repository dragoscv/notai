/**
 * POST handler for the consent form. Issues an authorization_code
 * and 302-redirects back to the client's redirect_uri.
 */
import { auth } from '@/auth';
import { findActiveClientByClientId, issueToken, upsertConsent } from '@/server/oauth-store';
import { TTL, intersectScopes, parseScopes } from '@notai/lib/oauth';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await req.formData();
  const decision = form.get('decision');
  let params: Record<string, string>;
  try {
    params = JSON.parse(String(form.get('params') ?? '{}'));
  } catch {
    return new Response('invalid_request', { status: 400 });
  }
  const grantedScopes = parseScopes(String(form.get('granted_scopes') ?? ''));

  const client = await findActiveClientByClientId(params.client_id ?? '');
  if (!client) return new Response('invalid_client', { status: 400 });

  const allowedRedirects = client.redirectUris ?? [];
  if (!params.redirect_uri || !allowedRedirects.includes(params.redirect_uri)) {
    return new Response('invalid redirect_uri', { status: 400 });
  }

  if (decision !== 'allow') {
    const url = new URL(params.redirect_uri);
    url.searchParams.set('error', 'access_denied');
    if (params.state) url.searchParams.set('state', params.state);
    return Response.redirect(url.toString(), 302);
  }

  // Final guard: never grant more than the client is allowed for.
  const finalScopes = intersectScopes(grantedScopes.join(' '), client.allowedScopes);
  if (finalScopes.length === 0) {
    const url = new URL(params.redirect_uri);
    url.searchParams.set('error', 'invalid_scope');
    if (params.state) url.searchParams.set('state', params.state);
    return Response.redirect(url.toString(), 302);
  }

  if (!params.code_challenge) {
    return new Response('invalid_request: missing code_challenge', { status: 400 });
  }
  const method = params.code_challenge_method ?? 'S256';
  if (method !== 'S256') {
    return new Response('invalid_request: only S256 PKCE is supported', { status: 400 });
  }

  await upsertConsent(session.user.id, client.id, finalScopes);

  const issued = await issueToken({
    clientId: client.id,
    userId: session.user.id,
    kind: 'authorization_code',
    scopes: finalScopes,
    ttlSeconds: TTL.authorizationCode,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: method,
    redirectUri: params.redirect_uri,
    metadata: {
      nonce: params.nonce,
      resource: params.resource,
    },
  });

  const url = new URL(params.redirect_uri);
  url.searchParams.set('code', issued.token);
  if (params.state) url.searchParams.set('state', params.state);
  // RFC 9207
  const reqUrl = new URL(req.url);
  url.searchParams.set('iss', `${reqUrl.protocol}//${reqUrl.host}`);
  return Response.redirect(url.toString(), 302);
}
