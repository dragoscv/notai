'use client';

/**
 * Shared note context-menu + action handlers.
 *
 * Centralises the rename / duplicate / icon / pin / favourite / archive /
 * delete / open-as-sticky operations that were previously only available
 * from the sidebar tree. Exposes a `<NoteContextMenu note>{children}</...>`
 * wrapper plus a matching dialogs bundle that each consumer must render
 * once so the confirm/prompt/icon modals have a mount point.
 *
 * Usage:
 *   const actions = useNoteActions();
 *   return (
 *     <>
 *       {notes.map((n) => (
 *         <actions.ContextMenu key={n.id} note={n}>
 *           <NoteCard note={n} />
 *         </actions.ContextMenu>
 *       ))}
 *       {actions.dialogs}
 *     </>
 *   );
 */

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Pencil,
  Smile,
  Copy,
  Pin,
  PinOff,
  Star,
  StarOff,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Trash2,
  Layers as LayersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuTrigger,
} from '@notai/ui/components/context-menu';
import type { Note } from '@notai/db/schema';
import { updateNote, deleteNote, duplicateNote, togglePinnedOnToday } from '@/server/actions/notes';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { usePrompt } from '@/components/ui/prompt-dialog';
import { IconPicker } from '@/components/ui/icon-picker';

export function useNoteActions() {
  const t = useTranslations('editor.actions');
  const router = useRouter();
  const pathname = usePathname();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { prompt, dialog: promptDialog } = usePrompt();

  const [iconTarget, setIconTarget] = React.useState<{ id: string; current: string | null } | null>(
    null,
  );

  const rename = React.useCallback(
    (note: Note) =>
      prompt({
        title: t('renameTitle'),
        label: t('renameField'),
        defaultValue: note.title,
        confirmLabel: t('renameSubmit'),
        maxLength: 200,
        onSubmit: async (title) => {
          await updateNote({ id: note.id, title });
          router.refresh();
        },
      }),
    [prompt, router, t],
  );

  const duplicate = React.useCallback(
    async (note: Note) => {
      try {
        const copy = await duplicateNote(note.id);
        if (copy) {
          toast.success(t('duplicated'));
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('duplicateFailed'));
      }
    },
    [router, t],
  );

  const toggleFlag = React.useCallback(
    async (note: Note, flag: 'isPinned' | 'isFavorite' | 'isArchived', next: boolean) => {
      try {
        await updateNote({ id: note.id, [flag]: next });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('updateFailed'));
      }
    },
    [router, t],
  );

  const removeNote = React.useCallback(
    (note: Note) =>
      confirm({
        title: t('deleteTitle'),
        description: (
          <>
            {t.rich('deleteDescription', {
              titleText: note.title,
              title: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </>
        ),
        destructive: true,
        confirmLabel: t('deleteConfirm'),
        onConfirm: async () => {
          try {
            await deleteNote(note.id);
            if (pathname === `/app/n/${note.id}`) router.push('/app');
            else router.refresh();
            toast.success(t('deleted'));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t('deleteFailed'));
          }
        },
      }),
    [confirm, pathname, router, t],
  );

  const changeIcon = React.useCallback(
    (note: Note) => setIconTarget({ id: note.id, current: note.icon ?? null }),
    [],
  );

  const handleIconChange = React.useCallback(
    async (value: string | null) => {
      if (!iconTarget) return;
      try {
        await updateNote({ id: iconTarget.id, icon: value });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('iconUpdateFailed'));
      }
    },
    [iconTarget, router, t],
  );

  const openAsSticky = React.useCallback(async (note: Note) => {
    try {
      const mod = await import('@/lib/tauri');
      if (mod.isTauri()) {
        await mod.invoke('open_sticky', { noteId: note.id });
        return;
      }
    } catch {
      /* fall through */
    }
    window.open(`/sticky/${note.id}`, '_blank', 'popup=yes,width=360,height=480');
  }, []);

  const ContextMenuWrapper = React.useCallback(
    ({ note, children, asChild }: { note: Note; children: React.ReactNode; asChild?: boolean }) => (
      <ContextMenu>
        <ContextMenuTrigger asChild={asChild ?? true}>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={() => rename(note)}>
            <Pencil className="size-4" /> {t('rename')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => changeIcon(note)}>
            <Smile className="size-4" /> {t('changeIcon')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => duplicate(note)}>
            <Copy className="size-4" /> {t('duplicate')}
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <LayersIcon className="size-4" /> {t('moreLabel')}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52">
              <ContextMenuItem onSelect={() => openAsSticky(note)}>
                <ExternalLink className="size-4" /> {t('openSticky')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => toggleFlag(note, 'isPinned', !note.isPinned)}>
            {note.isPinned ? (
              <>
                <PinOff className="size-4" /> {t('unpin')}
              </>
            ) : (
              <>
                <Pin className="size-4" /> {t('pinToTop')}
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => togglePinnedOnToday(note.id)}>
            {note.isPinnedOnToday ? (
              <>
                <PinOff className="size-4" /> {t('unpinToday')}
              </>
            ) : (
              <>
                <Pin className="size-4" /> {t('pinToday')}
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => toggleFlag(note, 'isFavorite', !note.isFavorite)}>
            {note.isFavorite ? (
              <>
                <StarOff className="size-4" /> {t('removeFavorite')}
              </>
            ) : (
              <>
                <Star className="size-4" /> {t('addFavorite')}
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => toggleFlag(note, 'isArchived', !note.isArchived)}>
            {note.isArchived ? (
              <>
                <ArchiveRestore className="size-4" /> {t('unarchive')}
              </>
            ) : (
              <>
                <Archive className="size-4" /> {t('archive')}
              </>
            )}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => removeNote(note)}
          >
            <Trash2 className="size-4" /> {t('delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ),
    [rename, changeIcon, duplicate, openAsSticky, toggleFlag, removeNote, t],
  );

  const dialogs = (
    <>
      {confirmDialog}
      {promptDialog}
      <IconPicker
        open={iconTarget !== null}
        onOpenChange={(v) => {
          if (!v) setIconTarget(null);
        }}
        value={iconTarget?.current ?? null}
        onChange={handleIconChange}
        title={t('iconTitle')}
      />
    </>
  );

  return { ContextMenu: ContextMenuWrapper, dialogs };
}
