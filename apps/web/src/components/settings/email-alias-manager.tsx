'use client';

import * as React from 'react';
import { Button } from '@notai/ui/components/button';
import { Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { rotateEmailAlias, type EmailAliasInfo } from '@/server/actions/email-alias';

export function EmailAliasManager({ initial }: { initial: EmailAliasInfo }) {
  const t = useTranslations('settings.emailAlias');
  const [alias, setAlias] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(alias.address);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFail'));
    }
  }

  async function rotate() {
    if (!window.confirm(t('confirmRotate'))) return;
    setBusy(true);
    try {
      const next = await rotateEmailAlias();
      setAlias(next);
      toast.success(t('rotated'));
    } catch (err) {
      toast.error((err as Error).message || t('failedRotate'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {t('yourAddress')}
      </label>
      <div className="flex items-center gap-2">
        <code className="bg-muted flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
          {alias.address}
        </code>
        <Button size="sm" variant="ghost" onClick={() => void copy()} aria-label={t('copyAria')}>
          <Copy className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void rotate()}
          disabled={busy}
          aria-label={t('rotateAria')}
        >
          <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t('footer')}</p>
    </div>
  );
}
