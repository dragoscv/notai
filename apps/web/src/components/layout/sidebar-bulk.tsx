'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, FolderInput, Star, Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@notai/ui/components/dropdown-menu';
import type { Folder } from '@notai/db/schema';
import { bulkUpdateNotes, bulkDeleteNotes } from '@/server/actions/notes';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface SidebarSelectionValue {
  enabled: boolean;
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clear: () => void;
  enable: (initialId?: string) => void;
}

const SidebarSelectionContext = React.createContext<SidebarSelectionValue | null>(null);

export function SidebarSelectionProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMany = React.useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => {
    setSelected(new Set());
    setEnabled(false);
  }, []);

  const enable = React.useCallback((initialId?: string) => {
    setEnabled(true);
    if (initialId) setSelected((prev) => new Set(prev).add(initialId));
  }, []);

  const value = React.useMemo<SidebarSelectionValue>(
    () => ({ enabled, selected, toggle, selectMany, clear, enable }),
    [enabled, selected, toggle, selectMany, clear, enable],
  );

  return (
    <SidebarSelectionContext.Provider value={value}>{children}</SidebarSelectionContext.Provider>
  );
}

export function useSidebarSelection(): SidebarSelectionValue {
  const ctx = React.useContext(SidebarSelectionContext);
  if (!ctx) {
    // Soft fallback: if a NoteRow renders outside the provider (e.g. some
    // sticky pop-out), pretend selection is disabled. Cleaner than
    // throwing and breaking the whole sidebar.
    return {
      enabled: false,
      selected: new Set(),
      toggle: () => undefined,
      selectMany: () => undefined,
      clear: () => undefined,
      enable: () => undefined,
    };
  }
  return ctx;
}

/**
 * Floating bottom-of-sidebar action bar shown whenever one or more notes
 * are selected. Supports archive/unarchive, favorite toggle, move-to-folder,
 * delete, and exit.
 */
export function SidebarBulkBar({ folders }: { folders: Folder[] }) {
  const { enabled, selected, clear } = useSidebarSelection();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [pending, startTransition] = React.useTransition();

  if (!enabled || selected.size === 0) {
    return confirmDialog;
  }

  const ids = [...selected];

  const runPatch = (patch: Parameters<typeof bulkUpdateNotes>[0]['patch'], label: string) => {
    startTransition(async () => {
      try {
        const { updated } = await bulkUpdateNotes({ ids, patch });
        toast.success(`${label} ${updated} note${updated === 1 ? '' : 's'}`);
        clear();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${label} failed`);
      }
    });
  };

  const move = (folderId: string | null) => {
    runPatch({ folderId }, 'Moved');
  };

  const doDelete = () => {
    confirm({
      title: `Delete ${ids.length} note${ids.length === 1 ? '' : 's'}?`,
      description: 'They will move to trash and can be restored for 30 days.',
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        startTransition(async () => {
          try {
            const { deleted } = await bulkDeleteNotes(ids);
            toast.success(`Deleted ${deleted} note${deleted === 1 ? '' : 's'}`);
            clear();
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed');
          }
        });
      },
    });
  };

  return (
    <>
      {confirmDialog}
      <div className="bg-card/95 border-primary/20 sticky bottom-0 z-10 mx-2 mb-2 flex flex-col gap-1.5 rounded-xl border p-2 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-medium">{ids.length} selected</span>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={clear}
            disabled={pending}
            aria-label="Cancel selection"
            title="Cancel (Esc)"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => runPatch({ isArchived: true }, 'Archived')}
            disabled={pending}
          >
            <Archive className="size-3.5" /> Archive
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runPatch({ isArchived: false }, 'Restored')}
            disabled={pending}
          >
            <ArchiveRestore className="size-3.5" /> Unarchive
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runPatch({ isFavorite: true }, 'Favorited')}
            disabled={pending}
          >
            <Star className="size-3.5" /> Favorite
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                <FolderInput className="size-3.5" /> Move
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
              <DropdownMenuLabel>Move to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => move(null)}>(Root, no folder)</DropdownMenuItem>
              {folders.length === 0 && <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>}
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => move(f.id)}>
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="destructive"
            onClick={doDelete}
            disabled={pending}
            className="ml-auto"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Tiny visual marker shown to the left of a sidebar note row when
 * selection mode is on. Clicking the checkbox toggles selection; the
 * row's click handler also toggles when in selection mode (instead of
 * navigating).
 */
export function SidebarSelectCheckbox({
  noteId,
  className,
}: {
  noteId: string;
  className?: string;
}) {
  const { enabled, selected, toggle } = useSidebarSelection();
  if (!enabled) return null;
  const isSelected = selected.has(noteId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(noteId);
      }}
      className={className}
      aria-label={isSelected ? 'Deselect' : 'Select'}
    >
      <CheckSquare
        className={isSelected ? 'text-primary size-3.5' : 'text-muted-foreground/50 size-3.5'}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
    </button>
  );
}
