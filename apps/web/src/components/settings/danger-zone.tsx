'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import { requestAccountDeletion, cancelAccountDeletion } from '@/server/actions/account-deletion';

interface Props {
  deletion: { requestedAt: string | null; graceDays: number; purgesAt: string | null };
  userEmail: string;
}

export function DangerZone({ deletion, userEmail }: Props) {
  const t = useTranslations('settings.danger');
  const [confirmText, setConfirmText] = useState('');
  const [stepUpCode, setStepUpCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (deletion.requestedAt && deletion.purgesAt) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          {t('scheduledPrefix')} <strong>{new Date(deletion.purgesAt).toLocaleString()}</strong>
          {t('scheduledMiddle')} <em>{t('scheduledCancel')}</em> {t('scheduledSuffix')}
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await cancelAccountDeletion();
              if (r.ok) toast.success(t('cancelled'));
              else toast.error(t('couldNotCancel'));
            })
          }
        >
          {pending ? <Spinner className="size-4" /> : null}
          {t('cancelDeletion')}
        </Button>
      </div>
    );
  }

  const matches = confirmText.trim().toLowerCase() === userEmail.trim().toLowerCase();

  return (
    <div className="space-y-3 text-sm">
      <p>{t('body', { days: deletion.graceDays })}</p>
      <label className="block">
        <span className="text-muted-foreground text-xs">
          {t('typeEmailPrefix')}
          <code>{userEmail || t('unknown')}</code>
          {t('typeEmailSuffix')}
        </span>
        <input
          type="email"
          autoComplete="off"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="bg-background mt-1 w-full rounded-md border px-2.5 py-1.5"
        />
      </label>
      {stepUpCode !== null ? (
        <label className="block">
          <span className="text-muted-foreground text-xs">{t('authCodeLabel')}</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={stepUpCode}
            onChange={(e) => setStepUpCode(e.target.value)}
            className="bg-background mt-1 w-40 rounded-md border px-2.5 py-1.5 font-mono"
            placeholder="123456"
          />
        </label>
      ) : null}
      <Button
        variant="destructive"
        disabled={!matches || pending}
        onClick={() => {
          if (!matches) return;
          if (!confirm(t('confirmSchedule'))) return;
          startTransition(async () => {
            const r = await requestAccountDeletion(stepUpCode ?? undefined);
            if (r.stepUpRequired) {
              setStepUpCode((c) => c ?? '');
              if (r.error) toast.error(r.error);
              else toast.message(t('authCodeToast'));
              return;
            }
            if (!r.ok) toast.error(r.error ?? t('couldNotSchedule'));
            // On success the action signs you out and redirects to '/'.
          });
        }}
      >
        {pending ? <Spinner className="size-4" /> : null}
        {t('scheduleDeletion')}
      </Button>
    </div>
  );
}
