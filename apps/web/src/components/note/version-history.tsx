'use client';
import * as React from 'react';
import { History, RefreshCcw, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@notai/ui';
import {
  listVersions,
  restoreVersion,
  deleteVersion,
} from '@/server/actions/versions';

interface Version {
  id: string;
  authorId: string | null;
  sizeBytes: number;
  label: string | null;
  createdAt: Date;
  preview: string;
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

  const refresh = async () => {
    setLoading(true);
    try {
      const v = await listVersions(noteId);
      setVersions(v);
      if (v.length > 0) setSelected(v[0] ?? null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, noteId]);

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
            <ul className="max-h-[60vh] divide-y overflow-y-auto rounded-lg border bg-card text-xs">
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
                    <p className="font-medium">
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground">
                      {(v.sizeBytes / 1024).toFixed(1)} KB
                      {v.label ? ` · ${v.label}` : ''}
                    </p>
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
              <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
                {selected ? selected.preview || '(empty)' : 'Select a snapshot to preview.'}
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
