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
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-start gap-3">
          {app.logoUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.logoUri} alt="" className="h-11 w-11 rounded-lg border object-cover" />
          ) : (
            <div className="from-primary to-primary/70 text-primary-foreground grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-base font-semibold">
              {app.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-medium">{app.name}</div>
            <div className="text-muted-foreground text-xs">
              {app.type === 'public' ? 'Public client (PKCE)' : 'Confidential client'}
              {app.dynamicallyRegistered ? ' · auto-registered' : ''}
            </div>
            {app.clientUri ? (
              <a
                href={app.clientUri}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground mt-1 inline-block text-xs underline-offset-2 hover:underline"
              >
                {new URL(app.clientUri).host}
              </a>
            ) : null}
          </div>
        </div>

        <h1 className="mt-5 font-serif text-xl font-semibold tracking-tight">
          Connect to your notai
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          <span className="text-foreground font-medium">{app.name}</span> is asking permission to:
        </p>

        <ul className="mt-4 space-y-3">
          {grantedScopes.map((scope) => {
            const meta = SCOPE_LABELS[scope] ?? {
              title: scope,
              desc: 'Custom scope.',
            };
            return (
              <li key={scope} className="flex gap-3 text-sm">
                <div className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{meta.title}</div>
                  <div className="text-muted-foreground text-xs leading-snug">{meta.desc}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {app.description ? (
          <p className="bg-muted/50 text-muted-foreground mt-4 rounded-md p-3 text-xs">
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
          <input type="hidden" name="granted_scopes" value={grantedScopes.join(' ')} />
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

        <p className="text-muted-foreground mt-4 text-[11px]">
          Signed in as{' '}
          <span className="text-foreground/80 font-medium">{user.email ?? user.name ?? 'you'}</span>
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
