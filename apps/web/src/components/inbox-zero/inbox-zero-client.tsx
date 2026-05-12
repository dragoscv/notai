'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Folder, Sparkles, Inbox, ArrowRight, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import { listFolders } from '@/server/actions/folders';
import { moveNote, deleteNote, updateNote } from '@/server/actions/notes';
import { summarizeInboxItems } from '@/server/actions/inbox-summarize';
import type { UnfiledSuggestion } from '@/server/actions/inbox-zero';

interface FolderRow {
  id: string;
  name: string;
}

interface Props {
  initial: UnfiledSuggestion[];
}

export function InboxZeroClient({ initial }: Props) {
  const t = useTranslations('appFeatures.inboxZero');
  const router = useRouter();
  const [items, setItems] = React.useState<UnfiledSuggestion[]>(initial);
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const [folders, setFolders] = React.useState<FolderRow[] | null>(null);
  const [override, setOverride] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleSelect = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = React.useCallback(() => setSelected(new Set()), []);
  const selectAll = React.useCallback(() => {
    setSelected(new Set(items.map((it) => it.noteId)));
  }, [items]);

  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkArchiving, setBulkArchiving] = React.useState(false);
  const bulkDelete = React.useCallback(async () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        selected.size === 1
          ? t('bulkDeleteConfirmOne', { count: selected.size })
          : t('bulkDeleteConfirmOther', { count: selected.size }),
      )
    )
      return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    try {
      for (const id of ids) {
        await deleteNote(id);
      }
      setItems((xs) => xs.filter((x) => !selected.has(x.noteId)));
      clearSelection();
      toast.success(t('movedToTrash', { count: ids.length }));
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkDeleting(false);
    }
  }, [selected, clearSelection, router]);

  const bulkArchive = React.useCallback(async () => {
    if (selected.size === 0) return;
    setBulkArchiving(true);
    const ids = Array.from(selected);
    try {
      for (const id of ids) {
        await updateNote({ id, isArchived: true });
      }
      setItems((xs) => xs.filter((x) => !selected.has(x.noteId)));
      clearSelection();
      toast.success(
        ids.length === 1
          ? t('archivedToastOne', { count: ids.length })
          : t('archivedToastOther', { count: ids.length }),
      );
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkArchiving(false);
    }
  }, [selected, clearSelection, router]);

  React.useEffect(() => {
    void listFolders().then((rows) => setFolders(rows.map((f) => ({ id: f.id, name: f.name }))));
  }, []);

  const move = React.useCallback(
    async (noteId: string, folderId: string) => {
      setBusy((b) => ({ ...b, [noteId]: true }));
      // Snapshot so the toast Undo can put the note back. Inbox-Zero
      // items always come from `folderId IS NULL`, so undo means
      // `moveNote({ noteId, folderId: null })`.
      const removed = items.find((x) => x.noteId === noteId) ?? null;
      try {
        await moveNote({ noteId, folderId });
        setItems((xs) => xs.filter((x) => x.noteId !== noteId));
        toast.success(t('filed'), {
          action: {
            label: t('undo'),
            onClick: () => {
              void (async () => {
                try {
                  await moveNote({ noteId, folderId: null });
                  if (removed) setItems((xs) => [removed, ...xs]);
                  toast.message(t('undoToast'));
                  router.refresh();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              })();
            },
          },
        });
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy((b) => ({ ...b, [noteId]: false }));
      }
    },
    [items, router],
  );

  const confidentItems = React.useMemo(
    () =>
      items.filter(
        (it) => it.suggestedFolderId != null && it.similarity != null && it.similarity >= 0.65,
      ),
    [items],
  );

  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [gists, setGists] = React.useState<Record<string, string>>({});
  const [gistBusy, setGistBusy] = React.useState(false);
  const bulkFile = React.useCallback(async () => {
    if (confidentItems.length === 0) return;
    setBulkBusy(true);
    const moved: Array<{ noteId: string; folderId: string; item: UnfiledSuggestion }> = [];
    try {
      for (const it of confidentItems) {
        const folderId = it.suggestedFolderId;
        if (!folderId) continue;
        await moveNote({ noteId: it.noteId, folderId });
        moved.push({ noteId: it.noteId, folderId, item: it });
      }
      setItems((xs) => xs.filter((x) => !moved.find((m) => m.noteId === x.noteId)));
      toast.success(
        moved.length === 1
          ? t('filedManyOne', { count: moved.length })
          : t('filedManyOther', { count: moved.length }),
        {
          action: {
            label: t('undoAll'),
            onClick: () => {
              void (async () => {
                try {
                  for (const m of moved) {
                    await moveNote({ noteId: m.noteId, folderId: null });
                  }
                  setItems((xs) => [...moved.map((m) => m.item), ...xs]);
                  toast.message(t('undoAllToast'));
                  router.refresh();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              })();
            },
          },
        },
      );
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }, [confidentItems, router]);

  const fetchGists = React.useCallback(async () => {
    if (gistBusy) return;
    const targetIds = items.slice(0, 12).map((it) => it.noteId);
    if (targetIds.length === 0) return;
    setGistBusy(true);
    try {
      const next = await summarizeInboxItems({ noteIds: targetIds });
      setGists((g) => ({ ...g, ...next }));
    } catch (err) {
      toast.error((err as Error).message || t('gistFailed'));
    } finally {
      setGistBusy(false);
    }
  }, [items, gistBusy]);

  if (items.length === 0) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
        <Inbox className="text-muted-foreground size-8" />
        <p className="font-medium">{t('emptyHeading')}</p>
        <p className="text-muted-foreground text-sm">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="bg-card sticky top-0 z-10 flex items-center gap-2 rounded-xl border p-3 shadow-sm">
          <span className="text-sm font-medium">
            {t('selectedCount', { count: selected.size })}
          </span>
          <Button size="sm" variant="ghost" onClick={selectAll}>
            {t('selectAll')}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            {t('clear')}
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={bulkArchive} disabled={bulkArchiving}>
            {bulkArchiving ? (
              <Spinner className="size-3.5" />
            ) : (
              <>
                <Archive className="size-3.5" /> {t('archive')}
              </>
            )}
          </Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? (
              <Spinner className="size-3.5" />
            ) : (
              <>
                <Trash2 className="size-3.5" /> {t('moveToTrash')}
              </>
            )}
          </Button>
        </div>
      )}
      {confidentItems.length > 0 && (
        <div className="bg-card flex items-center gap-3 rounded-xl border p-3">
          <Sparkles className="text-primary size-4" />
          <div className="flex-1 text-sm">
            {confidentItems.length === 1
              ? t('readyAutoFileOne', { count: confidentItems.length })
              : t('readyAutoFileOther', { count: confidentItems.length })}
          </div>
          <Button size="sm" onClick={bulkFile} disabled={bulkBusy}>
            {bulkBusy ? (
              <Spinner className="size-3.5" />
            ) : (
              <>
                {t('fileAll')} <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </div>
      )}
      {Object.keys(gists).length === 0 && items.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={fetchGists} disabled={gistBusy}>
            {gistBusy ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {t('aiGistEach')}
          </Button>
        </div>
      )}
      <ul className="space-y-3">
        {items.map((it) => {
          const targetFolderId = override[it.noteId] ?? it.suggestedFolderId;
          const targetFolderName =
            override[it.noteId] != null
              ? (folders?.find((f) => f.id === override[it.noteId])?.name ?? '')
              : it.suggestedFolderName;
          const confidence = it.similarity != null ? Math.round(it.similarity * 100) : null;
          return (
            <li key={it.noteId} className="bg-card rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(it.noteId)}
                  onChange={() => toggleSelect(it.noteId)}
                  aria-label={t('selectAria', { title: it.noteTitle || t('untitled') })}
                  className="mt-1 size-4 cursor-pointer accent-current"
                />
                <span className="text-xl leading-none" aria-hidden>
                  {it.noteIcon ?? '📝'}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/n/${it.noteId}`}
                    className="hover:text-foreground block truncate font-medium"
                  >
                    {it.noteTitle || t('untitled')}
                  </Link>
                  {it.notePlaintext && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {it.notePlaintext}
                    </p>
                  )}
                  {gists[it.noteId] && (
                    <p className="text-primary/80 mt-1 line-clamp-1 text-xs italic">
                      \u2728 {gists[it.noteId]}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {targetFolderId ? (
                      <>
                        <Sparkles className="text-primary size-3.5" />
                        <span className="text-muted-foreground text-xs">{t('suggested')}</span>
                        <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                          <Folder className="size-3" />
                          {targetFolderName}
                        </span>
                        {confidence != null && override[it.noteId] == null && (
                          <span className="text-muted-foreground text-xs">
                            {t('matchPercent', { percent: confidence })}
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={() => move(it.noteId, targetFolderId)}
                          disabled={busy[it.noteId]}
                          className="ml-auto"
                        >
                          {busy[it.noteId] ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <>
                              {t('fileHere')} <ArrowRight className="size-3.5" />
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t('noClearMatch')}</span>
                    )}
                  </div>
                  {folders && folders.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setOverride((o) => ({ ...o, [it.noteId]: f.id }))}
                          className={`hover:bg-muted rounded-full border px-2 py-0.5 text-xs ${
                            override[it.noteId] === f.id ? 'bg-muted border-primary' : ''
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
