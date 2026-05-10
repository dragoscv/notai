'use client';

import * as React from 'react';
import { Button } from '@notai/ui/components/button';
import { Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { rotateEmailAlias, type EmailAliasInfo } from '@/server/actions/email-alias';

export function EmailAliasManager({ initial }: { initial: EmailAliasInfo }) {
  const [alias, setAlias] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(alias.address);
      toast.success('Address copied.');
    } catch {
      toast.error('Could not copy. Select and copy manually.');
    }
  }

  async function rotate() {
    if (
      !window.confirm(
        'Rotate the address? The old one will stop working immediately. Update any saved contacts or shortcuts.',
      )
    )
      return;
    setBusy(true);
    try {
      const next = await rotateEmailAlias();
      setAlias(next);
      toast.success('Address rotated.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to rotate');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Your address
      </label>
      <div className="flex items-center gap-2">
        <code className="bg-muted flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
          {alias.address}
        </code>
        <Button size="sm" variant="ghost" onClick={() => void copy()} aria-label="Copy">
          <Copy className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void rotate()}
          disabled={busy}
          aria-label="Rotate"
        >
          <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Subject → note title. Body → note content. Only mail from your account email is accepted.
      </p>
    </div>
  );
}
