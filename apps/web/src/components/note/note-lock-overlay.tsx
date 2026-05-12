'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Lock, LockKeyhole, Unlock } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Input } from '@notai/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@notai/ui/components/dialog';

const LOCKS_KEY = 'notai:note-locks-v1';
const SESSION_KEY = 'notai:note-locks-session-v1';

interface LocksMap {
  [noteId: string]: { hash: string };
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readLocks(): LocksMap {
  try {
    return JSON.parse(localStorage.getItem(LOCKS_KEY) ?? '{}') as LocksMap;
  } catch {
    return {};
  }
}
function writeLocks(map: LocksMap) {
  try {
    localStorage.setItem(LOCKS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
function readSessionUnlocks(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function persistSessionUnlocks(set: Set<string>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/**
 * Floating lock button + unlock overlay. Renders one fixed-position
 * button in the top-right that opens a "Lock note / Unlock / Remove
 * lock" dialog, plus a full-cover unlock gate when the note is locked
 * and not yet unlocked in this session.
 *
 * Casual privacy gate \u2014 the hash is stored client-side and the doc
 * itself remains in the Y.Doc. Anyone with devtools or DB access can
 * still see the content. Useful for shoulder-surfing protection only.
 */
export function NoteLockOverlay({ noteId }: { noteId: string }) {
  const t = useTranslations('editor.lock');
  const tDialog = useTranslations('editor.lock.dialog');
  const [locked, setLocked] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState(false);
  const [dialog, setDialog] = React.useState<'set' | 'enter' | null>(null);
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const locks = readLocks();
    const has = !!locks[noteId];
    setLocked(has);
    if (has && readSessionUnlocks().has(noteId)) setUnlocked(true);
    setReady(true);
  }, [noteId]);

  const setPin = async () => {
    if (draft.length < 3) {
      setError(tDialog('tooShort'));
      return;
    }
    const hash = await sha256(draft);
    const locks = readLocks();
    locks[noteId] = { hash };
    writeLocks(locks);
    setLocked(true);
    setUnlocked(true);
    const ses = readSessionUnlocks();
    ses.add(noteId);
    persistSessionUnlocks(ses);
    setDraft('');
    setError(null);
    setDialog(null);
  };

  const removeLock = () => {
    const locks = readLocks();
    delete locks[noteId];
    writeLocks(locks);
    setLocked(false);
    setUnlocked(false);
  };

  const tryUnlock = async () => {
    const locks = readLocks();
    const meta = locks[noteId];
    if (!meta) return;
    const hash = await sha256(draft);
    if (hash !== meta.hash) {
      setError(tDialog('wrong'));
      return;
    }
    setUnlocked(true);
    const ses = readSessionUnlocks();
    ses.add(noteId);
    persistSessionUnlocks(ses);
    setDraft('');
    setError(null);
    setDialog(null);
  };

  if (!ready) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (locked && unlocked) removeLock();
          else if (locked) setDialog('enter');
          else setDialog('set');
        }}
        title={locked ? (unlocked ? t('removeLock') : t('unlockNote')) : t('lockNote')}
        aria-label={locked ? t('unlockNote') : t('lockNote')}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </button>

      {locked && !unlocked && (
        <div className="bg-background/95 fixed inset-0 z-[160] flex flex-col items-center justify-center gap-4 backdrop-blur">
          <LockKeyhole className="text-muted-foreground size-12 opacity-60" />
          <p className="text-muted-foreground text-sm">{t('locked')}</p>
          <Button onClick={() => setDialog('enter')}>{t('unlock')}</Button>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'set' ? tDialog('setTitle') : tDialog('enterTitle')}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'set' ? tDialog('setDescription') : tDialog('enterDescription')}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (dialog === 'set') void setPin();
                else void tryUnlock();
              }
            }}
            placeholder={tDialog('pinPlaceholder')}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {tDialog('cancel')}
            </Button>
            <Button onClick={() => (dialog === 'set' ? void setPin() : void tryUnlock())}>
              {dialog === 'set' ? tDialog('lock') : tDialog('unlock')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
