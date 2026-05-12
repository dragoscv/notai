'use client';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { revokeConnectedApp } from '@/server/actions/oauth-clients';

interface ConnectedAppCardProps {
  app: {
    consentId: string;
    clientId: string;
    clientPublicId: string;
    name: string;
    description: string | null;
    logoUri: string | null;
    clientUri: string | null;
    type: 'public' | 'confidential';
    dynamicallyRegistered: boolean;
    scopes: string;
    grantedAt: Date;
    updatedAt: Date;
  };
}

export function ConnectedAppCard({ app }: ConnectedAppCardProps) {
  const t = useTranslations('settings.pages.connectedApps');
  const [pending, start] = useTransition();
  const scopes = app.scopes.split(/\s+/).filter(Boolean);

  return (
    <div className="bg-card flex items-start gap-4 rounded-xl border p-4">
      {app.logoUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={app.logoUri} alt="" className="size-10 shrink-0 rounded-lg border object-cover" />
      ) : (
        <div className="from-primary to-primary/70 text-primary-foreground grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br font-semibold">
          {app.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-medium">{app.name}</span>
          <span className="text-muted-foreground text-xs">
            {app.type === 'public' ? t('publicClient') : t('confidentialClient')}
            {app.dynamicallyRegistered ? ` · ${t('autoRegistered')}` : ''}
          </span>
        </div>
        {app.description ? (
          <p className="text-muted-foreground mt-1 text-xs">{app.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {scopes.map((s) => (
            <span
              key={s}
              className="bg-muted/50 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
            >
              {s}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px]">
          {t('grantedOn', {
            grantedAt: new Date(app.grantedAt).toLocaleDateString(),
            updatedAt: new Date(app.updatedAt).toLocaleDateString(),
          })}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(t('confirmRevoke', { name: app.name }))) return;
          start(() => revokeConnectedApp(app.clientId));
        }}
      >
        {pending ? t('revoking') : t('revoke')}
      </Button>
    </div>
  );
}
