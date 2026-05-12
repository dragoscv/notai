'use client';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { revokeMyClient } from '@/server/actions/oauth-clients';

interface MyClientCardProps {
  client: {
    id: string;
    clientId: string;
    name: string;
    type: 'public' | 'confidential';
    redirectUris: string[];
    allowedScopes: string;
    dynamicallyRegistered: boolean;
    createdAt: Date;
    revokedAt: Date | null;
  };
}

export function MyClientCard({ client }: MyClientCardProps) {
  const t = useTranslations('settings.pages.connectedApps');
  const [pending, start] = useTransition();
  const revoked = !!client.revokedAt;

  return (
    <div className={`bg-card rounded-xl border p-4 ${revoked ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{client.name}</div>
          <div className="text-muted-foreground text-[11px] uppercase tracking-wider">
            {client.type === 'public' ? t('myClientPublic') : t('myClientConfidential')}
            {client.dynamicallyRegistered ? ` · ${t('dcr')}` : ''}
            {revoked ? ` · ${t('revoked')}` : ''}
          </div>
        </div>
        {!revoked ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!confirm(t('confirmRevokeClient', { name: client.name }))) return;
              start(() => revokeMyClient(client.id));
            }}
          >
            {pending ? t('revoking') : t('revoke')}
          </Button>
        ) : null}
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <Row label="client_id">
          <code className="break-all">{client.clientId}</code>
        </Row>
        <Row label="redirect_uris">
          <ul className="space-y-0.5">
            {client.redirectUris.map((u) => (
              <li key={u}>
                <code className="text-muted-foreground break-all">{u}</code>
              </li>
            ))}
          </ul>
        </Row>
        <Row label="scopes">
          <code className="text-muted-foreground">{client.allowedScopes}</code>
        </Row>
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3">
      <dt className="text-foreground font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
