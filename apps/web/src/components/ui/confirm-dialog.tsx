'use client';

import { useState, useCallback, useTransition, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@notai/ui/components/dialog';
import { Button } from '@notai/ui/components/button';
import { Input } from '@notai/ui/components/input';
import { Label } from '@notai/ui/components/label';

export interface ConfirmDialogOptions {
  title: string;
  description: ReactNode;
  /** Confirm button label. Default: "Continue". */
  confirmLabel?: string;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
  /** Use the destructive button variant for the confirm action. */
  destructive?: boolean;
  /**
   * If set, the confirm button stays disabled until the user types this
   * exact string into the text input. Use for unrecoverable actions
   * like deleting a folder with children.
   */
  confirmTypedText?: string;
  /** The async work to run when the user confirms. Errors are surfaced. */
  onConfirm: () => void | Promise<void>;
}

interface ConfirmState extends ConfirmDialogOptions {
  open: boolean;
  typed: string;
}

/**
 * Imperative confirmation dialog hook.
 *
 * Returns `confirm(opts)` to open a dialog plus the dialog element to render
 * once in the consumer tree. Keeps wiring minimal for all the places that
 * need a "Are you sure?" prompt (delete note, delete folder, etc.).
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    setState({ ...opts, open: true, typed: '' });
  }, []);

  const close = () => setState((s) => (s ? { ...s, open: false } : s));

  const handleConfirm = () => {
    if (!state) return;
    startTransition(async () => {
      try {
        await state.onConfirm();
        close();
      } catch {
        /* Caller is expected to show its own toast on error. */
      }
    });
  };

  const typedMatches = !state?.confirmTypedText || state.typed.trim() === state.confirmTypedText;

  const dialog = (
    <Dialog
      open={!!state?.open}
      onOpenChange={(next) => {
        if (!next && !pending) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          <DialogDescription asChild>
            <div>{state?.description}</div>
          </DialogDescription>
        </DialogHeader>

        {state?.confirmTypedText ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-typed">
              Type <span className="font-mono font-medium">{state.confirmTypedText}</span> to
              confirm
            </Label>
            <Input
              id="confirm-typed"
              autoFocus
              value={state.typed}
              onChange={(e) => setState((s) => (s ? { ...s, typed: e.target.value } : s))}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={close}>
            {state?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            type="button"
            variant={state?.destructive ? 'destructive' : 'default'}
            disabled={pending || !typedMatches}
            onClick={handleConfirm}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {state?.confirmLabel ?? 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
