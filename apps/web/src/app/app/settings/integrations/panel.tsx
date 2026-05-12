'use client';
import * as React from 'react';
import Link from 'next/link';
import { Copy, Plus, Trash2, Bot, Chrome, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@notai/ui';
import { createPersonalAccessToken, revokePersonalAccessToken } from '@/server/actions/pat';

interface TokenRow {
  id: string;
  name: string;
  scope: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export function IntegrationsPanel({ tokens: initialTokens }: { tokens: TokenRow[] }) {
  const t = useTranslations('settings.pages.integrations');
  const [tokens, setTokens] = React.useState(initialTokens);
  const [draftName, setDraftName] = React.useState('Web clipper');
  const [draftScopes, setDraftScopes] = React.useState<string[]>(['clipper']);
  const [revealed, setRevealed] = React.useState<{ id: string; token: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const ALL_SCOPES = ['clipper', 'notes:read', 'notes:write', 'search:read', 'ai:read'] as const;

  const toggleScope = (s: string) =>
    setDraftScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const create = () => {
    const name = draftName.trim();
    if (!name || draftScopes.length === 0) return;
    startTransition(async () => {
      try {
        const out = await createPersonalAccessToken({
          name,
          scopes: draftScopes as (typeof ALL_SCOPES)[number][],
        });
        const scopeStr = [...draftScopes].sort().join(' ');
        setRevealed(out);
        setTokens((arr) => [
          {
            id: out.id,
            name,
            scope: scopeStr,
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
          },
          ...arr,
        ]);
        setDraftName('Web clipper');
        setDraftScopes(['clipper']);
      } catch (err) {
        toast.error((err as Error).message ?? t('failedCreateToken'));
      }
    });
  };

  const revoke = (id: string) =>
    startTransition(async () => {
      await revokePersonalAccessToken(id);
      setTokens((arr) => arr.map((t) => (t.id === id ? { ...t, revokedAt: new Date() } : t)));
    });

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://notai.ro';

  const mcpUrl = `${baseUrl}/api/mcp`;
  const oauthIssuer = `${baseUrl}/api/oauth`;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('intro')}</p>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Bot className="size-4" /> {t('mcpHeading')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('mcpDesc')}</p>
        <div className="bg-card space-y-2 rounded-xl border p-4 text-sm">
          <Field label={t('fMcpEndpoint')} value={mcpUrl} />
          <Field label={t('fOauthIssuer')} value={oauthIssuer} />
          <Field label={t('fAuthUrl')} value={`${oauthIssuer}/authorize`} />
          <Field label={t('fTokenUrl')} value={`${oauthIssuer}/token`} />
          <Field label={t('fDcr')} value={`${oauthIssuer}/register`} />
        </div>
        <details className="bg-muted/30 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t('claudeSetup')}</summary>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
            <li>{t('claudeStep1')}</li>
            <li>
              {t('claudeStep2Prefix')} <code>mcpServers</code> {t('claudeStep2Suffix')}
            </li>
            <li>{t('claudeStep3')}</li>
          </ol>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Chrome className="size-4" /> {t('clipperHeading')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('clipperDesc')}</p>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="border-input bg-background flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
              placeholder={t('tokenNamePh')}
            />
            <Button onClick={create} disabled={pending || draftScopes.length === 0}>
              <Plus className="mr-1 size-4" /> {t('createToken')}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALL_SCOPES.map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                  draftScopes.includes(s) ? 'bg-primary text-primary-foreground' : 'bg-background'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={draftScopes.includes(s)}
                  onChange={() => toggleScope(s)}
                />
                {s}
              </label>
            ))}
          </div>

          {revealed && (
            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">{t('copyTokenWarn')}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-background/80 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
                  {revealed.token}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(revealed.token);
                    toast.success(t('tokenCopied'));
                  }}
                  className="rounded-md border px-2 py-1 text-xs"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <ul className="bg-card divide-y rounded-xl border text-sm">
          {tokens.length === 0 && <li className="text-muted-foreground p-4">{t('noTokens')}</li>}
          {tokens.map((tok) => (
            <li key={tok.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{tok.name}</p>
                <p className="text-muted-foreground text-xs">
                  {t('scopesLabel')} <span className="font-mono">{tok.scope || 'clipper'}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {tok.revokedAt
                    ? t('revokedLabel')
                    : tok.lastUsedAt
                      ? t('usedAgo', { when: formatRel(tok.lastUsedAt, t) })
                      : t('neverUsed')}
                  {' · '}
                  {t('createdAgo', { when: formatRel(tok.createdAt, t) })}
                </p>
              </div>
              {!tok.revokedAt && (
                <button
                  type="button"
                  onClick={() => revoke(tok.id)}
                  className="text-muted-foreground hover:text-destructive rounded-md p-1.5"
                  aria-label={t('revokeAria')}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <BookmarkletSection baseUrl={baseUrl} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Webhook className="size-4" /> {t('webhooksHeading')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('webhooksDesc')}</p>
        <Link
          href="/app/settings/webhooks"
          className="bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
        >
          <Webhook className="size-4" /> {t('manageWebhooks')}
        </Link>
      </section>
    </div>
  );
}

function BookmarkletSection({ baseUrl }: { baseUrl: string }) {
  const t = useTranslations('settings.pages.integrations');
  const code = React.useMemo(() => {
    const inner = `(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title||'');var s=encodeURIComponent((window.getSelection&&window.getSelection().toString())||'');window.open('${baseUrl}/clip?url='+u+'&title='+t+'&selection='+s,'_blank','noopener');})()`;
    return `javascript:${inner}`;
  }, [baseUrl]);
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Chrome className="size-4" /> {t('bookmarkletHeading')}
      </h2>
      <p className="text-muted-foreground text-sm">{t('bookmarkletDesc')}</p>
      <div className="bg-card flex items-center justify-between gap-3 rounded-xl border p-4">
        <a
          href={code}
          onClick={(e) => e.preventDefault()}
          className="bg-primary text-primary-foreground inline-flex cursor-grab items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm active:cursor-grabbing"
        >
          <Chrome className="size-4" />
          {t('clipToNotai')}
        </a>
        <span className="text-muted-foreground text-xs">{t('dragMe')}</span>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const t = useTranslations('settings.pages.integrations');
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-40 shrink-0 text-xs">{label}</span>
      <code className="bg-muted/60 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(t('copied'));
        }}
        className="rounded-md border px-1.5 py-1 text-xs"
        aria-label={t('copyAria')}
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

function formatRel(
  date: Date,
  t: (key: string, vals?: Record<string, string | number | Date>) => string,
) {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return t('today');
  if (days < 30) return t('daysAgo', { n: days });
  if (days < 365) return t('monthsAgo', { n: Math.floor(days / 30) });
  return t('yearsAgo', { n: Math.floor(days / 365) });
}
