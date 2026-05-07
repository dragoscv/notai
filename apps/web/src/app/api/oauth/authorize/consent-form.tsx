'use client';
import { useState } from 'react';
import { Button } from '@notai/ui/components/button';

/** Human-friendly labels for known scopes. */
const SCOPE_LABELS: Record<string, { title: string; desc: string }> = {
    openid: { title: 'Identity', desc: 'See your notai user id.' },
    profile: { title: 'Profile', desc: 'See your name and avatar.' },
    email: { title: 'Email address', desc: 'See the email you signed in with.' },
    offline_access: {
        title: 'Stay connected',
        desc: 'Refresh access without you signing in again.',
    },
    'notes:read': {
        title: 'Read your notes',
        desc: 'List, search, and read the contents of your notes and folders.',
    },
    'notes:write': {
        title: 'Create and edit notes',
        desc: 'Create new notes and update titles, content, and metadata.',
    },
    'notes:delete': {
        title: 'Archive notes',
        desc: 'Move your notes to the archive (no hard deletes).',
    },
    'folders:read': { title: 'Read folders', desc: 'See your folder hierarchy.' },
    'folders:write': {
        title: 'Manage folders',
        desc: 'Create, rename, and reorganise folders.',
    },
    mcp: {
        title: 'MCP tool access',
        desc: 'Use this app as a Model Context Protocol bridge so AI agents can act on your notes.',
    },
};

interface ConsentFormProps {
    app: {
        name: string;
        description: string | null;
        logoUri: string | null;
        clientUri: string | null;
        type: 'public' | 'confidential';
        dynamicallyRegistered: boolean;
    };
    grantedScopes: string[];
    params: Record<string, string>;
    user: { name: string | null; email: string | null };
}

export function ConsentForm({ app, grantedScopes, params, user }: ConsentFormProps) {
    const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-start gap-3">
                    {app.logoUri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={app.logoUri}
                            alt=""
                            className="h-11 w-11 rounded-lg border object-cover"
                        />
                    ) : (
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-base font-semibold text-primary-foreground">
                            {app.name.slice(0, 1).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-medium">{app.name}</div>
                        <div className="text-xs text-muted-foreground">
                            {app.type === 'public' ? 'Public client (PKCE)' : 'Confidential client'}
                            {app.dynamicallyRegistered ? ' · auto-registered' : ''}
                        </div>
                        {app.clientUri ? (
                            <a
                                href={app.clientUri}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                            >
                                {new URL(app.clientUri).host}
                            </a>
                        ) : null}
                    </div>
                </div>

                <h1 className="mt-5 font-serif text-xl font-semibold tracking-tight">
                    Connect to your notai
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{app.name}</span> is asking
                    permission to:
                </p>

                <ul className="mt-4 space-y-3">
                    {grantedScopes.map((scope) => {
                        const meta = SCOPE_LABELS[scope] ?? {
                            title: scope,
                            desc: 'Custom scope.',
                        };
                        return (
                            <li key={scope} className="flex gap-3 text-sm">
                                <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                <div className="min-w-0">
                                    <div className="font-medium leading-tight">{meta.title}</div>
                                    <div className="text-xs leading-snug text-muted-foreground">
                                        {meta.desc}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {app.description ? (
                    <p className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        {app.description}
                    </p>
                ) : null}

                <form
                    method="POST"
                    action="/api/oauth/authorize/decide"
                    className="mt-6 flex gap-2"
                    onSubmit={(e) => {
                        const target = (e.nativeEvent as SubmitEvent).submitter as
                            | HTMLButtonElement
                            | undefined;
                        setBusy(target?.value === 'allow' ? 'allow' : 'deny');
                    }}
                >
                    <input type="hidden" name="params" value={JSON.stringify(params)} />
                    <input
                        type="hidden"
                        name="granted_scopes"
                        value={grantedScopes.join(' ')}
                    />
                    <Button
                        type="submit"
                        name="decision"
                        value="deny"
                        variant="ghost"
                        disabled={busy !== null}
                        className="flex-1"
                    >
                        {busy === 'deny' ? 'Cancelling…' : 'Cancel'}
                    </Button>
                    <Button
                        type="submit"
                        name="decision"
                        value="allow"
                        disabled={busy !== null}
                        className="flex-1"
                    >
                        {busy === 'allow' ? 'Connecting…' : 'Allow'}
                    </Button>
                </form>

                <p className="mt-4 text-[11px] text-muted-foreground">
                    Signed in as{' '}
                    <span className="font-medium text-foreground/80">
                        {user.email ?? user.name ?? 'you'}
                    </span>
                    . You can revoke this app any time from{' '}
                    <a href="/app/settings/connected-apps" className="underline">
                        Connected apps
                    </a>
                    .
                </p>
            </div>
        </main>
    );
}
