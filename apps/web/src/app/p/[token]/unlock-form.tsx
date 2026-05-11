'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { unlockPublicShare } from '@/server/actions/public-share';

export function UnlockForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(unlockPublicShare, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm">
        <span className="text-muted-foreground mb-2 block">Password</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="border-input bg-background focus-visible:ring-ring shadow-xs w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
      </label>
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  );
}
