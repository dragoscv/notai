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
import {
    updateNote,
    deleteNote,
    duplicateNote,
} from '@/server/actions/notes';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { usePrompt } from '@/components/ui/prompt-dialog';
import { IconPicker } from '@/components/ui/icon-picker';

export function useNoteActions() {
    const router = useRouter();
    const pathname = usePathname();
    const { confirm, dialog: confirmDialog } = useConfirm();
    const { prompt, dialog: promptDialog } = usePrompt();

    const [iconTarget, setIconTarget] = React.useState<
        { id: string; current: string | null } | null
    >(null);

    const rename = React.useCallback(
        (note: Note) =>
            prompt({
                title: 'Rename note',
                label: 'Title',
                defaultValue: note.title,
                confirmLabel: 'Rename',
                maxLength: 200,
                onSubmit: async (title) => {
                    await updateNote({ id: note.id, title });
                    router.refresh();
                },
            }),
        [prompt, router],
    );

    const duplicate = React.useCallback(
        async (note: Note) => {
            try {
                const copy = await duplicateNote(note.id);
                if (copy) {
                    toast.success('Note duplicated');
                    router.refresh();
                }
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Duplicate failed');
            }
        },
        [router],
    );

    const toggleFlag = React.useCallback(
        async (
            note: Note,
            flag: 'isPinned' | 'isFavorite' | 'isArchived',
            next: boolean,
        ) => {
            try {
                await updateNote({ id: note.id, [flag]: next });
                router.refresh();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Update failed');
            }
        },
        [router],
    );

    const removeNote = React.useCallback(
        (note: Note) =>
            confirm({
                title: 'Delete note?',
                description: (
                    <>
                        <span className="font-medium">{note.title}</span> and its content will be
                        permanently deleted. This cannot be undone.
                    </>
                ),
                destructive: true,
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    try {
                        await deleteNote(note.id);
                        if (pathname === `/app/n/${note.id}`) router.push('/app');
                        else router.refresh();
                        toast.success('Note deleted');
                    } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Delete failed');
                    }
                },
            }),
        [confirm, pathname, router],
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
                toast.error(err instanceof Error ? err.message : 'Could not update icon');
            }
        },
        [iconTarget, router],
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
                        <Pencil className="size-4" /> Rename
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => changeIcon(note)}>
                        <Smile className="size-4" /> Change icon…
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => duplicate(note)}>
                        <Copy className="size-4" /> Duplicate
                    </ContextMenuItem>
                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <LayersIcon className="size-4" /> More
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-52">
                            <ContextMenuItem onSelect={() => openAsSticky(note)}>
                                <ExternalLink className="size-4" /> Open as sticky
                            </ContextMenuItem>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => toggleFlag(note, 'isPinned', !note.isPinned)}>
                        {note.isPinned ? (
                            <>
                                <PinOff className="size-4" /> Unpin
                            </>
                        ) : (
                            <>
                                <Pin className="size-4" /> Pin to top
                            </>
                        )}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => toggleFlag(note, 'isFavorite', !note.isFavorite)}>
                        {note.isFavorite ? (
                            <>
                                <StarOff className="size-4" /> Remove from favorites
                            </>
                        ) : (
                            <>
                                <Star className="size-4" /> Add to favorites
                            </>
                        )}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => toggleFlag(note, 'isArchived', !note.isArchived)}>
                        {note.isArchived ? (
                            <>
                                <ArchiveRestore className="size-4" /> Unarchive
                            </>
                        ) : (
                            <>
                                <Archive className="size-4" /> Archive
                            </>
                        )}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => removeNote(note)}
                    >
                        <Trash2 className="size-4" /> Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        ),
        [rename, changeIcon, duplicate, openAsSticky, toggleFlag, removeNote],
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
                title="Note icon"
            />
        </>
    );

    return { ContextMenu: ContextMenuWrapper, dialogs };
}
