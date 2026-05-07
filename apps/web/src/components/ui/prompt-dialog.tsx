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

export interface PromptDialogOptions {
  title: string;
  description?: ReactNode;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Max length of the input. Default 80. */
  maxLength?: number;
  /** Trims + validates the value. Return an error message string to block submit. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void | Promise<void>;
}

interface PromptState extends PromptDialogOptions {
  open: boolean;
  value: string;
  error: string | null;
}

/**
 * Imperative prompt dialog for short-form text input (folder names, rename
 * actions, etc.). Mirrors the API of `useConfirm`.
 */
export function usePrompt() {
  const [state, setState] = useState<PromptState | null>(null);
  const [pending, startTransition] = useTransition();

  const prompt = useCallback((opts: PromptDialogOptions) => {
    setState({
      ...opts,
      open: true,
      value: opts.defaultValue ?? '',
      error: null,
    });
  }, []);

  const close = () => setState((s) => (s ? { ...s, open: false } : s));

  const submit = () => {
    if (!state) return;
    const trimmed = state.value.trim();
    if (!trimmed) {
      setState((s) => (s ? { ...s, error: 'Value is required' } : s));
      return;
    }
    const maxLen = state.maxLength ?? 80;
    if (trimmed.length > maxLen) {
      setState((s) => (s ? { ...s, error: `Max ${maxLen} characters` } : s));
      return;
    }
    const validationError = state.validate?.(trimmed) ?? null;
    if (validationError) {
      setState((s) => (s ? { ...s, error: validationError } : s));
      return;
    }

    startTransition(async () => {
      try {
        await state.onSubmit(trimmed);
        close();
      } catch (err) {
        setState((s) => (s ? { ...s, error: err instanceof Error ? err.message : 'Failed' } : s));
      }
    });
  };

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
          {state?.description ? (
            <DialogDescription asChild>
              <div>{state.description}</div>
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="prompt-value">{state?.label}</Label>
          <Input
            id="prompt-value"
            autoFocus
            value={state?.value ?? ''}
            placeholder={state?.placeholder}
            onChange={(e) =>
              setState((s) => (s ? { ...s, value: e.target.value, error: null } : s))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={state?.maxLength ?? 80}
            autoComplete="off"
          />
          {state?.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={close}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {state?.confirmLabel ?? 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { prompt, dialog };
}
