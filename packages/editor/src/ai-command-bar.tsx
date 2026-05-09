'use client';
import * as React from 'react';
import type { Editor, Range } from '@tiptap/core';
import {
  Sparkles,
  ArrowRight,
  Wand2,
  AlignLeft,
  ListChecks,
  CheckSquare,
  Languages,
  Maximize2,
  Loader2,
  Square,
  X,
  Check,
} from 'lucide-react';
import type { SlashAiAction, SlashAiRunner } from './ai-types';

export interface AiCommandBarProps {
  editor: Editor;
  range: Range;
  runner: SlashAiRunner;
  noteId?: string;
  onClose: () => void;
}

interface ActionDef {
  id: SlashAiAction;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Free-form input field shown before running. */
  input?: { kind: 'text'; placeholder: string; field: 'prompt' | 'lang' };
  /** Tone presets shown as a row of chips. */
  tones?: readonly string[];
  /** Uses surrounding text as primary input (selection or whole block). */
  needsContext?: 'optional' | 'required';
}

const REWRITE_TONES = ['concise', 'formal', 'friendly', 'bullets', 'professional'] as const;

const ACTIONS: readonly ActionDef[] = [
  {
    id: 'write',
    label: 'Write',
    hint: 'Generate from a prompt',
    icon: Sparkles,
    input: { kind: 'text', placeholder: 'Describe what to write…', field: 'prompt' },
  },
  {
    id: 'continue',
    label: 'Continue',
    hint: 'Keep going from here',
    icon: ArrowRight,
    needsContext: 'optional',
  },
  {
    id: 'expand',
    label: 'Expand',
    hint: 'Bullets → prose',
    icon: Maximize2,
    needsContext: 'required',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    hint: '3–5 bullets',
    icon: AlignLeft,
    needsContext: 'optional',
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    hint: 'Change tone',
    icon: Wand2,
    needsContext: 'required',
    tones: REWRITE_TONES,
  },
  {
    id: 'action-items',
    label: 'Action items',
    hint: 'Extract a checklist',
    icon: ListChecks,
    needsContext: 'optional',
  },
  {
    id: 'improve',
    label: 'Improve',
    hint: 'Grammar + clarity',
    icon: CheckSquare,
    needsContext: 'required',
  },
  {
    id: 'translate',
    label: 'Translate',
    hint: 'Pick a language',
    icon: Languages,
    needsContext: 'required',
    input: { kind: 'text', placeholder: 'Target language (e.g. Romanian)', field: 'lang' },
  },
] as const;

type Phase =
  | { kind: 'menu' }
  | { kind: 'configure'; action: ActionDef }
  | {
      kind: 'streaming';
      action: ActionDef;
      controller: AbortController;
      insertedFrom: number;
      insertedTo: number;
    }
  | { kind: 'review'; action: ActionDef; insertedFrom: number; insertedTo: number; error?: string };

function getBlockText(editor: Editor): string {
  // Prefer the parent block of the selection.
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.isTextblock || node.type.spec.group?.includes('block')) {
      return node.textContent;
    }
  }
  return editor.getText();
}

function getSelectionText(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  if (empty) return '';
  return editor.state.doc.textBetween(from, to, '\n');
}

export function AiCommandBar({ editor, range, runner, noteId, onClose }: AiCommandBarProps) {
  const [phase, setPhase] = React.useState<Phase>({ kind: 'menu' });
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [text, setText] = React.useState('');
  const [tone, setTone] = React.useState<string>('concise');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Delete the literal "/ai" trigger range as soon as we open. The slash
  // suggestion plugin doesn't deleteRange because we hijack the command,
  // so do it ourselves at mount time.
  React.useEffect(() => {
    editor.chain().focus().deleteRange(range).run();
  }, [editor, range]);

  React.useEffect(() => {
    if (phase.kind === 'configure') {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const runAction = React.useCallback(
    (action: ActionDef, fields: { prompt?: string; tone?: string; lang?: string }) => {
      const selection = getSelectionText(editor);
      const blockText = getBlockText(editor);
      const insertPos = editor.state.selection.from;
      const controller = new AbortController();

      setPhase({
        kind: 'streaming',
        action,
        controller,
        insertedFrom: insertPos,
        insertedTo: insertPos,
      });

      // Replace the current selection (if any) with the streamed output;
      // otherwise insert at the cursor. Track [insertedFrom, insertedTo]
      // so "Discard" can roll back exactly the AI-produced range.
      let cursor = insertPos;
      if (!editor.state.selection.empty) {
        cursor = editor.state.selection.from;
        editor
          .chain()
          .focus()
          .deleteRange({ from: editor.state.selection.from, to: editor.state.selection.to })
          .run();
      }
      const startPos = cursor;
      let writePos = startPos;

      (async () => {
        try {
          for await (const chunk of runner(
            {
              action: action.id,
              prompt: fields.prompt,
              tone: fields.tone,
              lang: fields.lang,
              selection: selection || undefined,
              blockText: blockText || undefined,
              noteId,
            },
            controller.signal,
          )) {
            if (controller.signal.aborted) break;
            if (!chunk) continue;
            // Insert at writePos, then advance writePos by inserted length.
            editor.chain().insertContentAt(writePos, chunk, { updateSelection: false }).run();
            writePos += chunk.length;
            setPhase((prev) =>
              prev.kind === 'streaming'
                ? { ...prev, insertedFrom: startPos, insertedTo: writePos }
                : prev,
            );
          }
          setPhase({
            kind: 'review',
            action,
            insertedFrom: startPos,
            insertedTo: writePos,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed';
          setPhase({
            kind: 'review',
            action,
            insertedFrom: startPos,
            insertedTo: writePos,
            error: message,
          });
        }
      })();
    },
    [editor, runner, noteId],
  );

  const onPickAction = (action: ActionDef) => {
    if (action.input || action.tones) {
      setText('');
      setTone(action.tones?.[0] ?? 'concise');
      setPhase({ kind: 'configure', action });
      return;
    }
    runAction(action, {});
  };

  const stopStreaming = () => {
    if (phase.kind !== 'streaming') return;
    phase.controller.abort();
    setPhase({
      kind: 'review',
      action: phase.action,
      insertedFrom: phase.insertedFrom,
      insertedTo: phase.insertedTo,
    });
  };

  const discard = () => {
    if (phase.kind !== 'review' && phase.kind !== 'streaming') return;
    if (phase.kind === 'streaming') phase.controller.abort();
    const { insertedFrom, insertedTo } = phase;
    if (insertedTo > insertedFrom) {
      editor.chain().focus().deleteRange({ from: insertedFrom, to: insertedTo }).run();
    }
    onClose();
  };

  const keep = () => {
    if (phase.kind !== 'review') return;
    editor.chain().focus().setTextSelection(phase.insertedTo).run();
    onClose();
  };

  // Keyboard nav for the menu phase.
  React.useEffect(() => {
    if (phase.kind !== 'menu') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % ACTIONS.length);
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + ACTIONS.length) % ACTIONS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const action = ACTIONS[activeIdx];
        if (action) onPickAction(action);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, activeIdx]);

  if (phase.kind === 'menu') {
    return (
      <div className="bg-card min-w-[320px] max-w-[360px] rounded-lg border p-1 shadow-xl">
        <div className="text-muted-foreground flex items-center gap-1.5 px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide">
          <Sparkles className="size-3.5" />
          AI commands
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-accent ml-auto rounded p-0.5"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="grid gap-0.5 p-1">
          {ACTIONS.map((action, idx) => {
            const Icon = action.icon;
            const isActive = idx === activeIdx;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onPickAction(action)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  isActive ? 'bg-primary/15 text-foreground' : 'text-foreground/85'
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded border ${
                    isActive ? 'bg-primary/10 border-primary/30' : 'bg-muted/40'
                  }`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{action.label}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {action.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase.kind === 'configure') {
    const action = phase.action;
    const Icon = action.icon;
    const submit = () => {
      const fields: { prompt?: string; tone?: string; lang?: string } = {};
      if (action.input?.field === 'prompt') fields.prompt = text.trim();
      if (action.input?.field === 'lang') fields.lang = text.trim() || 'English';
      if (action.tones) fields.tone = tone;
      if (action.input && action.input.field === 'prompt' && !fields.prompt) return;
      runAction(action, fields);
    };
    return (
      <div className="bg-card min-w-[360px] rounded-lg border p-3 shadow-xl">
        <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Icon className="size-3.5" />
          {action.label}
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-accent ml-auto rounded p-0.5"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {action.input ? (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={action.input.placeholder}
            className="bg-background focus:ring-primary/30 w-full rounded border px-2.5 py-1.5 text-sm outline-none focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setPhase({ kind: 'menu' });
              } else if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
        ) : null}
        {action.tones ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {action.tones.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${
                  tone === t
                    ? 'bg-primary/20 border-primary/40 text-foreground'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPhase({ kind: 'menu' })}
            className="hover:bg-accent rounded px-2.5 py-1 text-xs"
          >
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            className="bg-primary text-primary-foreground rounded px-2.5 py-1 text-xs font-medium hover:opacity-90"
          >
            Run AI
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'streaming') {
    const Icon = phase.action.icon;
    return (
      <div className="bg-card flex items-center gap-2 rounded-lg border px-3 py-2 shadow-xl">
        <Loader2 className="size-3.5 animate-spin" />
        <Icon className="text-muted-foreground size-3.5" />
        <span className="text-sm">Generating…</span>
        <button
          type="button"
          onClick={stopStreaming}
          className="hover:bg-accent ml-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
          aria-label="Stop"
        >
          <Square className="size-3" />
          Stop
        </button>
      </div>
    );
  }

  // review
  const error = phase.kind === 'review' ? phase.error : undefined;
  return (
    <div className="bg-card flex items-center gap-2 rounded-lg border px-3 py-2 shadow-xl">
      {error ? (
        <span className="text-destructive text-sm">{error}</span>
      ) : (
        <span className="text-sm">Done.</span>
      )}
      <button
        type="button"
        onClick={discard}
        className="hover:bg-destructive/10 hover:text-destructive ml-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
      >
        <X className="size-3" />
        Discard
      </button>
      <button
        type="button"
        onClick={keep}
        className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
      >
        <Check className="size-3" />
        Keep
      </button>
    </div>
  );
}

export { ACTIONS as AI_COMMAND_BAR_ACTIONS };
