'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Lock, Unlock, KeyRound, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@notai/ui/components/dialog';
import { Input } from '@notai/ui/components/input';
import {
  deriveKEKFromPassphrase,
  decryptBytes,
  encryptString,
  decryptString,
  importRawAesKey,
  fromB64,
} from '@/lib/e2e';
import { getMyKeyEnvelope } from '@/server/actions/encryption';
import {
  enableNoteEncryption,
  disableNoteEncryption,
  getNoteCiphertext,
} from '@/server/actions/note-encryption';

/**
 * Session-scoped cache for the user's master AES-GCM key. Living in
 * module state means it survives in-page navigation but is wiped on
 * tab close (no persistence). The single-flight `unlockPromise` ensures
 * a hammered "Decrypt" button doesn't trigger N parallel PBKDF2 runs.
 */
let cachedMasterKey: CryptoKey | null = null;
let unlockPromise: Promise<CryptoKey> | null = null;

export function getCachedMasterKey(): CryptoKey | null {
  return cachedMasterKey;
}

export function clearCachedMasterKey(): void {
  cachedMasterKey = null;
}

/**
 * Prompt the user for their passphrase (modal) and unwrap the master
 * key. Resolves to a usable CryptoKey, cached for the session.
 */
export async function unlockMasterKey(passphrase: string): Promise<CryptoKey> {
  if (cachedMasterKey) return cachedMasterKey;
  const envelope = await getMyKeyEnvelope();
  if (!envelope) {
    throw new Error('Encryption is not set up on this account.');
  }
  const salt = fromB64(envelope.salt);
  const kek = await deriveKEKFromPassphrase(passphrase, salt, envelope.kdfIters);
  let raw: Uint8Array;
  try {
    raw = await decryptBytes(kek, envelope.encryptedMasterKey);
  } catch {
    throw new Error('Wrong passphrase.');
  }
  const master = await importRawAesKey(raw);
  cachedMasterKey = master;
  return master;
}

interface UnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (key: CryptoKey) => void;
  reason?: string;
}

/**
 * Modal that collects the passphrase, derives the KEK, unwraps the
 * master key, and hands it back to the caller via `onUnlocked`. Used
 * by both the in-note locked panel and the "Lock note" menu action
 * (since locking also needs the key to wrap the plaintext).
 */
export function UnlockKeyDialog({ open, onOpenChange, onUnlocked, reason }: UnlockDialogProps) {
  const [passphrase, setPassphrase] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setPassphrase('');
  }, [open]);

  const submit = async () => {
    if (!passphrase.trim()) return;
    setBusy(true);
    try {
      const promise = unlockPromise ?? unlockMasterKey(passphrase);
      unlockPromise = promise;
      const key = await promise;
      onUnlocked(key);
      onOpenChange(false);
      toast.success('Notes unlocked for this session');
    } catch (err) {
      toast.error((err as Error).message || 'Unlock failed');
    } finally {
      unlockPromise = null;
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Unlock encrypted notes
          </DialogTitle>
          <DialogDescription>
            {reason ??
              'Enter your master passphrase. Decryption happens entirely in your browser; the server never sees your key.'}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Master passphrase"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !passphrase.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}{' '}
            Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Read-only view shown when a note has `isEncrypted = true`. Fetches
 * the ciphertext, decrypts it client-side, renders as preformatted
 * text. The canvas / Excalidraw surface is not mounted for encrypted
 * notes — the user must unlock + disable encryption first to edit.
 */
export function EncryptedNotePanel({ noteId, title }: { noteId: string; title: string }) {
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = React.useState(false);
  const [disabling, setDisabling] = React.useState(false);

  const tryDecrypt = React.useCallback(async () => {
    setError(null);
    const key = getCachedMasterKey();
    if (!key) {
      setUnlockOpen(true);
      return;
    }
    try {
      const ct = await getNoteCiphertext(noteId);
      if (ct == null) {
        setError('Could not fetch ciphertext.');
        return;
      }
      const text = await decryptString(key, ct);
      setPlaintext(text);
    } catch (err) {
      setError((err as Error).message || 'Decryption failed');
    }
  }, [noteId]);

  React.useEffect(() => {
    void tryDecrypt();
  }, [tryDecrypt]);

  const turnOff = async () => {
    if (plaintext == null) return;
    if (
      !confirm('Disable encryption on this note? The plaintext will be stored on the server again.')
    ) {
      return;
    }
    setDisabling(true);
    try {
      await disableNoteEncryption({ noteId, plaintext });
      toast.success('Encryption disabled');
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message || 'Could not disable encryption');
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background/70 flex shrink-0 items-center gap-2 border-b px-4 py-2 backdrop-blur">
        <Lock className="text-primary size-4" />
        <span className="text-sm font-medium">End-to-end encrypted · read-only</span>
        <span className="text-muted-foreground ml-2 truncate text-sm">{title || 'Untitled'}</span>
        <div className="ml-auto flex items-center gap-2">
          {plaintext == null && (
            <Button size="sm" variant="outline" onClick={() => setUnlockOpen(true)}>
              <KeyRound className="size-3.5" /> Unlock
            </Button>
          )}
          {plaintext != null && (
            <Button size="sm" variant="outline" onClick={turnOff} disabled={disabling}>
              <Unlock className="size-3.5" /> Disable encryption
            </Button>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-8 py-6">
        {plaintext == null && error == null && (
          <div className="text-muted-foreground grid flex-1 place-items-center text-sm">
            <Loader2 className="size-4 animate-spin" /> Waiting for passphrase…
          </div>
        )}
        {error && (
          <div className="text-destructive flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4" /> {error}
          </div>
        )}
        {plaintext != null && (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{plaintext}</pre>
        )}
      </div>
      <UnlockKeyDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => void tryDecrypt()}
      />
    </div>
  );
}

/**
 * Imperatively lock the given note: derives the master key (prompting
 * the user if not cached), encrypts the plaintext, calls the server
 * action to store ciphertext + flip the flag. Returns true on success.
 */
export async function lockNoteFlow(noteId: string, plaintext: string): Promise<boolean> {
  let key = getCachedMasterKey();
  if (!key) {
    const passphrase = window.prompt(
      'Enter your master passphrase to encrypt this note. Decryption happens entirely in your browser.',
    );
    if (!passphrase) return false;
    try {
      key = await unlockMasterKey(passphrase);
    } catch (err) {
      toast.error((err as Error).message || 'Unlock failed');
      return false;
    }
  }
  const blob = await encryptString(key, plaintext);
  await enableNoteEncryption({ noteId, encryptedBody: blob });
  return true;
}
