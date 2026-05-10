'use client';

import * as React from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { unlockNote } from '@/server/actions/note-password';

/**
 * Full-bleed gate shown above the editor when a note is password-locked
 * and the current session hasn't unlocked it yet. On successful unlock
 * we trigger a hard refresh so the server can re-render the note with
 * its real content.
 */
export function NotePasswordGate({ noteId }: { noteId: string }) {
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      const res = await unlockNote({ noteId, password });
      if (!res.ok) {
        toast.error('Incorrect password');
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unlock');
      setBusy(false);
    }
  };

  return (
    <div className="grid place-items-center px-6 py-24">
      <form
        onSubmit={submit}
        className="bg-card w-full max-w-sm space-y-4 rounded-xl border p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Lock className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">This note is locked</h2>
            <p className="text-muted-foreground text-xs">
              Enter the password to unlock it for this session.
            </p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || !password} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : 'Unlock'}
        </Button>
      </form>
    </div>
  );
}
