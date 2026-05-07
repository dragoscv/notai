/**
 * Authorization endpoint (RFC 6749 §3.1).
 *
 * GET → renders the consent UI (or auto-approves for previously-consented
 *       scope sets). User must be signed in; if not, bounces through the
 *       normal sign-in flow and comes back to the same authorize URL.
 * POST handling lives in `./decide/route.ts`.
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import {
    findActiveClientByClientId,
    findConsent,
    issueToken,
} from '@/server/oauth-store';
import { TTL, intersectScopes, parseScopes, scopesCovered } from '@notai/lib/oauth';
import { ConsentForm } from './consent-form';

interface AuthorizeParams {
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    prompt?: string;
    resource?: string;
    nonce?: string;
}

export const dynamic = 'force-dynamic';

export default async function AuthorizePage({
    searchParams,
}: {
    searchParams: Promise<AuthorizeParams>;
}) {
    const params = await searchParams;
    const session = await auth();
    if (!session?.user?.id) {
        const callback = `/api/oauth/authorize?${new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null) as [string, string][],
        ).toString()}`;
        redirect(`/signin?callbackUrl=${encodeURIComponent(callback)}`);
    }

    if (params.response_type !== 'code') {
        return errorPage('unsupported_response_type', 'Only response_type=code is supported.');
    }
    if (!params.client_id) return errorPage('invalid_request', 'Missing client_id.');
    if (!params.redirect_uri) return errorPage('invalid_request', 'Missing redirect_uri.');

    const client = await findActiveClientByClientId(params.client_id);
    if (!client) return errorPage('invalid_client', 'Unknown client_id.');

    const allowedRedirects = client.redirectUris ?? [];
    if (!allowedRedirects.includes(params.redirect_uri)) {
        return errorPage(
            'invalid_request',
            'redirect_uri is not registered for this client.',
        );
    }

    // PKCE is required for ALL clients in OAuth 2.1 / MCP.
    if (!params.code_challenge) {
        return errorPage(
            'invalid_request',
            'code_challenge is required (PKCE).',
        );
    }
    const method = params.code_challenge_method ?? 'S256';
    if (method !== 'S256') {
        return errorPage('invalid_request', 'Only S256 PKCE is supported.');
    }

    const requested = parseScopes(params.scope ?? '');
    if (requested.length === 0) {
        return errorPage('invalid_scope', 'At least one scope is required.');
    }
    const grantedScopes = intersectScopes(params.scope ?? '', client.allowedScopes);
    if (grantedScopes.length === 0) {
        return errorPage(
            'invalid_scope',
            'None of the requested scopes are allowed for this client.',
        );
    }

    // ── Auto-approve when the user already consented to a superset ──
    if (params.prompt !== 'consent') {
        const prior = await findConsent(session.user.id, client.id);
        if (prior && scopesCovered(grantedScopes, parseScopes(prior.scopes))) {
            const issued = await issueToken({
                clientId: client.id,
                userId: session.user.id,
                kind: 'authorization_code',
                scopes: grantedScopes,
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
            const h = await headers();
            const host = h.get('x-forwarded-host') ?? h.get('host');
            const proto = h.get('x-forwarded-proto') ?? 'https';
            if (host) url.searchParams.set('iss', `${proto}://${host}`);
            redirect(url.toString());
        }
    }

    return (
        <ConsentForm
            app={{
                name: client.name,
                description: client.description,
                logoUri: client.logoUri,
                clientUri: client.clientUri,
                type: client.type,
                dynamicallyRegistered: client.dynamicallyRegistered,
            }}
            grantedScopes={grantedScopes}
            params={params as Record<string, string>}
            user={{
                name: session.user.name ?? null,
                email: session.user.email ?? null,
            }}
        />
    );
}

function errorPage(code: string, msg: string) {
    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-8">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <h1 className="font-serif text-xl font-semibold tracking-tight">
                    Authorization failed
                </h1>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {code}
                </p>
                <p className="mt-3 text-sm text-foreground/80">{msg}</p>
            </div>
        </main>
    );
}
