'use client';
import * as React from 'react';
import { Copy, Plus, Trash2, Bot, Chrome } from 'lucide-react';
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
  const [tokens, setTokens] = React.useState(initialTokens);
  const [draftName, setDraftName] = React.useState('Web clipper');
  const [revealed, setRevealed] = React.useState<{ id: string; token: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const create = () => {
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const out = await createPersonalAccessToken({ name, scope: 'clipper' });
        setRevealed(out);
        setTokens((arr) => [
          {
            id: out.id,
            name,
            scope: 'clipper',
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
          },
          ...arr,
        ]);
        setDraftName('Web clipper');
      } catch (err) {
        toast.error((err as Error).message ?? 'Failed to create token');
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
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect Notai to Claude, ChatGPT, the browser clipper, and other tools.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Bot className="size-4" /> Claude / ChatGPT (MCP)
        </h2>
        <p className="text-muted-foreground text-sm">
          Notai exposes a Model Context Protocol server so AI assistants can read and create your
          notes with your permission. Both Claude Desktop and the ChatGPT custom-tools beta speak
          MCP natively.
        </p>
        <div className="bg-card space-y-2 rounded-xl border p-4 text-sm">
          <Field label="MCP endpoint" value={mcpUrl} />
          <Field label="OAuth issuer" value={oauthIssuer} />
          <Field label="Authorization URL" value={`${oauthIssuer}/authorize`} />
          <Field label="Token URL" value={`${oauthIssuer}/token`} />
          <Field label="Dynamic registration" value={`${oauthIssuer}/register`} />
        </div>
        <details className="bg-muted/30 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Claude Desktop setup</summary>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
            <li>Open Claude → Settings → Developer → Edit config.</li>
            <li>
              Add an entry under <code>mcpServers</code> with the URL above and OAuth.
            </li>
            <li>Restart Claude. You&apos;ll be redirected to Notai to authorize.</li>
          </ol>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Chrome className="size-4" /> Web clipper
        </h2>
        <p className="text-muted-foreground text-sm">
          The browser extension uses a Personal Access Token (PAT) that you can create here and
          revoke any time.
        </p>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="border-input bg-background flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
              placeholder="Token name"
            />
            <Button onClick={create} disabled={pending}>
              <Plus className="mr-1 size-4" /> Create token
            </Button>
          </div>

          {revealed && (
            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">Copy this now — it won&apos;t be shown again.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-background/80 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
                  {revealed.token}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(revealed.token);
                    toast.success('Token copied');
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
          {tokens.length === 0 && <li className="text-muted-foreground p-4">No tokens yet.</li>}
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-muted-foreground text-xs">
                  {t.revokedAt
                    ? 'Revoked'
                    : t.lastUsedAt
                      ? `Used ${formatRel(t.lastUsedAt)}`
                      : 'Never used'}
                  {' · '}created {formatRel(t.createdAt)}
                </p>
              </div>
              {!t.revokedAt && (
                <button
                  type="button"
                  onClick={() => revoke(t.id)}
                  className="text-muted-foreground hover:text-destructive rounded-md p-1.5"
                  aria-label="Revoke"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
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
          toast.success('Copied');
        }}
        className="rounded-md border px-1.5 py-1 text-xs"
        aria-label="Copy"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

function formatRel(date: Date) {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
