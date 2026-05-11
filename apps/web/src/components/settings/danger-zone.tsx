'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import { requestAccountDeletion, cancelAccountDeletion } from '@/server/actions/account-deletion';

interface Props {
  deletion: { requestedAt: string | null; graceDays: number; purgesAt: string | null };
  userEmail: string;
}

export function DangerZone({ deletion, userEmail }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [pending, startTransition] = useTransition();

  if (deletion.requestedAt && deletion.purgesAt) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Your account is scheduled for deletion on{' '}
          <strong>{new Date(deletion.purgesAt).toLocaleString()}</strong>. Sign in any time before
          then and click <em>Cancel</em> to keep your account.
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await cancelAccountDeletion();
              if (r.ok) toast.success('Account deletion cancelled');
              else toast.error('Could not cancel');
            })
          }
        >
          {pending ? <Spinner className="size-4" /> : null}
          Cancel deletion
        </Button>
      </div>
    );
  }

  const matches = confirmText.trim().toLowerCase() === userEmail.trim().toLowerCase();

  return (
    <div className="space-y-3 text-sm">
      <p>
        Your notes, drawings, comments, sessions, API keys, and passkeys will be permanently deleted
        after a {deletion.graceDays}-day grace period. Within that window you can sign in and
        cancel.
      </p>
      <label className="block">
        <span className="text-muted-foreground text-xs">
          Type your email (<code>{userEmail || 'unknown'}</code>) to confirm:
        </span>
        <input
          type="email"
          autoComplete="off"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="bg-background mt-1 w-full rounded-md border px-2.5 py-1.5"
        />
      </label>
      <Button
        variant="destructive"
        disabled={!matches || pending}
        onClick={() => {
          if (!matches) return;
          if (!confirm('Schedule account deletion?')) return;
          startTransition(async () => {
            const r = await requestAccountDeletion();
            if (!r.ok) toast.error('Could not schedule deletion');
            // On success the action signs you out and redirects to '/'.
          });
        }}
      >
        {pending ? <Spinner className="size-4" /> : null}
        Schedule deletion
      </Button>
    </div>
  );
}
