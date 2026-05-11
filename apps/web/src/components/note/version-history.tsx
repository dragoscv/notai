'use client';
import * as React from 'react';
import { History, RefreshCcw, Loader2, Trash2, GitCompare, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import {
  listVersions,
  restoreVersion,
  deleteVersion,
  ensureRecentSnapshot,
  labelVersion,
} from '@/server/actions/versions';
import { getNote } from '@/server/actions/notes';

interface Version {
  id: string;
  authorId: string | null;
  sizeBytes: number;
  label: string | null;
  createdAt: Date;
  preview: string;
}

interface DiffLine {
  kind: 'same' | 'add' | 'del';
  text: string;
}

interface DiffWord {
  kind: 'same' | 'add' | 'del';
  text: string;
}

/**
 * Word-level diff inside a single line. Splits on whitespace,
 * keeps the separators so we can rejoin without rewrites.
 */
function diffWords(a: string, b: string): DiffWord[] {
  const tokens = (s: string) => s.split(/(\s+)/);
  const A = tokens(a);
  const B = tokens(b);
  const m = A.length;
  const n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffWord[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      out.push({ kind: 'same', text: A[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: 'del', text: A[i]! });
      i++;
    } else {
      out.push({ kind: 'add', text: B[j]! });
      j++;
    }
  }
  while (i < m) out.push({ kind: 'del', text: A[i++]! });
  while (j < n) out.push({ kind: 'add', text: B[j++]! });
  return out;
}

/**
 * Tiny line-level diff via Longest Common Subsequence. Good enough
 * for a 60-snapshot panel; we don't need word-level precision.
 */
function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split('\n');
  const B = b.split('\n');
  const m = A.length;
  const n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      out.push({ kind: 'same', text: A[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: 'del', text: A[i]! });
      i++;
    } else {
      out.push({ kind: 'add', text: B[j]! });
      j++;
    }
  }
  while (i < m) out.push({ kind: 'del', text: A[i++]! });
  while (j < n) out.push({ kind: 'add', text: B[j++]! });
  return out;
}

/**
 * "Time-travel through this note" UI. Shows snapshots written by the
 * realtime server and lets the user preview + restore. Restore replaces
 * the current Y.Doc — open windows reconnect on next load.
 */
export function VersionHistory({ noteId }: { noteId: string }) {
  const [open, setOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<Version[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Version | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [showDiff, setShowDiff] = React.useState(false);
  const [currentText, setCurrentText] = React.useState<string>('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      // Lazy hourly snapshot \u2014 if it's been quiet for over an hour
      // we record a fresh snapshot so the user always sees something
      // recent in the timeline.
      try {
        await ensureRecentSnapshot(noteId);
      } catch {
        /* non-fatal */
      }
      const v = await listVersions(noteId);
      setVersions(v);
      if (v.length > 0) setSelected(v[0] ?? null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  React.useEffect(() => {
    if (!open || !showDiff) return;
    void getNote(noteId)
      .then((n) => setCurrentText(n?.plaintext ?? ''))
      .catch(() => setCurrentText(''));
  }, [open, showDiff, noteId]);

  const restore = (v: Version) =>
    startTransition(async () => {
      try {
        await restoreVersion({ noteId, versionId: v.id });
        toast.success('Restored. Reload other windows to see the change.');
        setOpen(false);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });

  const remove = (v: Version) =>
    startTransition(async () => {
      await deleteVersion({ noteId, versionId: v.id });
      setVersions((arr) => arr?.filter((x) => x.id !== v.id) ?? null);
      if (selected?.id === v.id) setSelected(null);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
      >
        <History className="size-3.5" /> History
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" /> Version history
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <ul className="bg-card max-h-[60vh] divide-y overflow-y-auto rounded-lg border text-xs">
              {loading && (
                <li className="text-muted-foreground p-3 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </li>
              )}
              {versions?.length === 0 && (
                <li className="text-muted-foreground p-3 text-center">
                  No snapshots yet. Edits become snapshots after activity.
                </li>
              )}
              {versions?.map((v) => (
                <li
                  key={v.id}
                  className={`flex items-center gap-1 px-3 py-2 ${
                    selected?.id === v.id ? 'bg-muted' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium">{new Date(v.createdAt).toLocaleString()}</p>
                    <p className="text-muted-foreground">
                      {(v.sizeBytes / 1024).toFixed(1)} KB
                      {v.label ? ` · ${v.label}` : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = window.prompt('Label this snapshot:', v.label ?? '');
                      if (next === null) return;
                      try {
                        await labelVersion({
                          noteId,
                          versionId: v.id,
                          label: next.trim() ? next.trim() : null,
                        });
                        setVersions((rows) =>
                          rows
                            ? rows.map((r) =>
                                r.id === v.id ? { ...r, label: next.trim() || null } : r,
                              )
                            : rows,
                        );
                        toast.success('Label saved');
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground p-1"
                    aria-label="Label snapshot"
                    disabled={pending}
                  >
                    <Tag className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Delete snapshot"
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                  {showDiff ? 'Diff vs current' : 'Snapshot preview'}
                </p>
                {selected && (
                  <button
                    type="button"
                    onClick={() => setShowDiff((v) => !v)}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px]"
                  >
                    <GitCompare className="size-3" />
                    {showDiff ? 'Plain preview' : 'Compare with current'}
                  </button>
                )}
              </div>
              <div className="bg-card max-h-[60vh] overflow-y-auto rounded-lg border p-4 text-sm">
                {!selected ? (
                  <span className="text-muted-foreground">Select a snapshot to preview.</span>
                ) : showDiff ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {(() => {
                      const lines = diffLines(selected.preview, currentText);
                      const out: React.ReactNode[] = [];
                      for (let i = 0; i < lines.length; i++) {
                        const l = lines[i]!;
                        const next = lines[i + 1];
                        // Pair an adjacent del+add into a word-level diff for
                        // a much more readable rewrite view.
                        if (l.kind === 'del' && next && next.kind === 'add') {
                          const words = diffWords(l.text, next.text);
                          out.push(
                            <div key={i}>
                              <span className="text-muted-foreground">~ </span>
                              {words.map((w, k) => (
                                <span
                                  key={k}
                                  className={
                                    w.kind === 'add'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : w.kind === 'del'
                                        ? 'bg-rose-500/15 text-rose-700 line-through dark:text-rose-300'
                                        : ''
                                  }
                                >
                                  {w.text}
                                </span>
                              ))}
                            </div>,
                          );
                          i++; // skip the paired add
                          continue;
                        }
                        out.push(
                          <div
                            key={i}
                            className={
                              l.kind === 'add'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : l.kind === 'del'
                                  ? 'bg-rose-500/10 text-rose-700 line-through dark:text-rose-300'
                                  : 'text-muted-foreground'
                            }
                          >
                            {l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : '  '}
                            {l.text || '\u00a0'}
                          </div>,
                        );
                      }
                      return out;
                    })()}
                  </pre>
                ) : (
                  <span className="whitespace-pre-wrap">{selected.preview || '(empty)'}</span>
                )}
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={() => restore(selected)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  <RefreshCcw className="size-3.5" /> Restore this version
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
