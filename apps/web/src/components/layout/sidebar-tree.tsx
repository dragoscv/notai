'use client';

/**
 * Sidebar tree — folders and notes, with:
 *  - Drag & drop reordering (within folders + across folders + to root)
 *  - Expand/collapse per folder (state persisted to localStorage)
 *  - Right-click context menus with full functionality
 *  - Confirmation dialogs for destructive actions
 *
 * State shape:
 *  - `folders` is a flat list; we bucket into a tree on render.
 *  - `notes` is a flat list; already filtered to non-archived by the server.
 *  - Drag-and-drop uses @dnd-kit. Each draggable has a stable id of the form
 *    `note:<id>` or `folder:<id>`. Drop zones exist for folder contents and
 *    for reordering between items at the same level.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSyncExternalStore, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ChevronRight,
  FolderIcon,
  FolderOpen,
  Plus,
  Pin,
  PinOff,
  Star,
  StarOff,
  Copy,
  Trash2,
  Pencil,
  GitMerge,
  FolderPlus,
  FilePlus2,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Download,
  Printer,
  ClipboardCopy,
  Layers as LayersIcon,
  Hash,
  BookmarkPlus,
  CheckSquare,
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
import { cn } from '@notai/lib/utils';
import type { Note, Folder } from '@notai/db/schema';
import {
  createNote,
  updateNote,
  deleteNote,
  duplicateNote,
  moveNote,
  exportNoteMarkdown,
} from '@/server/actions/notes';
import { exportNoteDoc } from '@/server/actions/export';
import {
  createFolder,
  renameFolder,
  deleteFolder,
  moveFolder,
  setFolderIcon,
} from '@/server/actions/folders';
import { FolderDefaultTagsDialog } from './folder-default-tags-dialog';
import { createPersonalTemplate } from '@/server/actions/templates';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { usePrompt } from '@/components/ui/prompt-dialog';
import { EmbedStatusIndicator } from '@/components/layout/embed-status-indicator';
import { NoteMergeDialog } from '@/components/note/note-merge-dialog';
import { NewFromTemplateButton } from './new-from-template-button';
import {
  SidebarSelectionProvider,
  SidebarBulkBar,
  SidebarSelectCheckbox,
  useSidebarSelection,
} from './sidebar-bulk';

/* --------------------- Expanded-state persistence ------------------------ */

const LS_EXPANDED = 'notai:sidebar-expanded';

function readExpanded(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(LS_EXPANDED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

let expandedCache = new Set<string>();
let expandedLoaded = false;
const expandedListeners = new Set<() => void>();

function ensureExpandedLoaded() {
  if (expandedLoaded || typeof window === 'undefined') return;
  expandedCache = readExpanded();
  expandedLoaded = true;
}

function writeExpanded(next: Set<string>) {
  expandedCache = next;
  try {
    window.localStorage.setItem(LS_EXPANDED, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
  expandedListeners.forEach((l) => l());
}

function subscribeExpanded(cb: () => void) {
  expandedListeners.add(cb);
  return () => {
    expandedListeners.delete(cb);
  };
}

function getExpandedSnapshot(): Set<string> {
  ensureExpandedLoaded();
  return expandedCache;
}

const EMPTY_EXPANDED: Set<string> = new Set();
function getExpandedServerSnapshot(): Set<string> {
  return EMPTY_EXPANDED;
}

function useExpandedFolders() {
  const expanded = useSyncExternalStore(
    subscribeExpanded,
    getExpandedSnapshot,
    getExpandedServerSnapshot,
  );
  const toggle = useCallback((id: string) => {
    const next = new Set(expandedCache);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeExpanded(next);
  }, []);
  const expand = useCallback((id: string) => {
    const next = new Set(expandedCache);
    next.add(id);
    writeExpanded(next);
  }, []);
  return { expanded, toggle, expand };
}

/* ------------------------ Tree build + drag types ----------------------- */

type DragId = { kind: 'note'; id: string } | { kind: 'folder'; id: string };

type DropTarget =
  | { kind: 'folder-contents'; folderId: string | null } // drop into a folder (or root)
  | { kind: 'before'; draggable: DragId } // reorder above this item
  | { kind: 'after'; draggable: DragId }; // reorder below this item

function encodeDrag(d: DragId): string {
  return `${d.kind}:${d.id}`;
}
function decodeDrag(s: string): DragId | null {
  const [kind, id] = s.split(':');
  if ((kind === 'note' || kind === 'folder') && id) return { kind, id } as DragId;
  return null;
}

function encodeDrop(t: DropTarget): string {
  if (t.kind === 'folder-contents') return `contents:${t.folderId ?? 'root'}`;
  return `${t.kind}:${encodeDrag(t.draggable)}`;
}
function decodeDrop(s: string): DropTarget | null {
  if (s.startsWith('contents:')) {
    const rest = s.slice('contents:'.length);
    return { kind: 'folder-contents', folderId: rest === 'root' ? null : rest };
  }
  if (s.startsWith('before:')) {
    const d = decodeDrag(s.slice('before:'.length));
    if (d) return { kind: 'before', draggable: d };
  }
  if (s.startsWith('after:')) {
    const d = decodeDrag(s.slice('after:'.length));
    if (d) return { kind: 'after', draggable: d };
  }
  return null;
}

interface TreeNode {
  folder: Folder;
  children: TreeNode[];
  notes: Note[];
}

/** Build a nested folder tree from flat arrays. Notes at root are returned separately. */
function buildTree(folders: Folder[], notes: Note[]) {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.position - b.position);

  const notesByFolder = new Map<string | null, Note[]>();
  for (const n of notes) {
    const key = n.folderId ?? null;
    if (!notesByFolder.has(key)) notesByFolder.set(key, []);
    notesByFolder.get(key)!.push(n);
  }
  for (const arr of notesByFolder.values()) arr.sort((a, b) => a.position - b.position);

  function build(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      folder,
      children: build(folder.id),
      notes: notesByFolder.get(folder.id) ?? [],
    }));
  }

  return {
    rootFolders: build(null),
    rootNotes: notesByFolder.get(null) ?? [],
  };
}

/* --------------------------- Main component ----------------------------- */

export interface SidebarTreeProps {
  folders: Folder[];
  notes: Note[];
}

export function SidebarTree({ folders, notes }: SidebarTreeProps) {
  return (
    <SidebarSelectionProvider>
      <SidebarTreeInner folders={folders} notes={notes} />
    </SidebarSelectionProvider>
  );
}

function SidebarTreeInner({ folders, notes }: SidebarTreeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { expanded, toggle, expand } = useExpandedFolders();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { prompt, dialog: promptDialog } = usePrompt();
  const selection = useSidebarSelection();

  React.useEffect(() => {
    if (!selection.enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selection.clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection]);

  const [activeDrag, setActiveDrag] = React.useState<DragId | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const tree = useMemo(() => buildTree(folders, notes), [folders, notes]);

  const handleDragStart = (e: DragStartEvent) => {
    const drag = decodeDrag(String(e.active.id));
    if (drag) setActiveDrag(drag);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    if (!e.over) return;
    const drag = decodeDrag(String(e.active.id));
    const drop = decodeDrop(String(e.over.id));
    if (!drag || !drop) return;

    // Ignore drops onto self
    if (
      drop.kind !== 'folder-contents' &&
      drop.draggable.kind === drag.kind &&
      drop.draggable.id === drag.id
    ) {
      return;
    }

    try {
      if (drag.kind === 'note') {
        const { folderId, index } = resolveTargetIndex(drop, folders, notes, drag);
        await moveNote({ noteId: drag.id, folderId, index });
      } else {
        const { parentId, index } = resolveFolderTargetIndex(drop, folders);
        await moveFolder({ id: drag.id, parentId, index });
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed');
    }
  };

  /* ---- Actions used by context menus + header buttons -------------- */

  const openNewNote = async (folderId: string | null) => {
    try {
      const note = await createNote({ folderId });
      if (folderId) expand(folderId);
      if (note) router.push(`/app/n/${note.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create note');
    }
  };

  const openNewFolder = (parentId: string | null) => {
    prompt({
      title: 'New folder',
      label: 'Folder name',
      placeholder: 'Ideas, Work, Recipes…',
      confirmLabel: 'Create',
      defaultValue: '',
      onSubmit: async (name) => {
        await createFolder({ name, parentId });
        if (parentId) expand(parentId);
        router.refresh();
      },
    });
  };

  const renameNoteAction = (note: Note) => {
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
    });
  };

  const renameFolderAction = (folder: Folder) => {
    prompt({
      title: 'Rename folder',
      label: 'Folder name',
      defaultValue: folder.name,
      confirmLabel: 'Rename',
      onSubmit: async (name) => {
        await renameFolder({ id: folder.id, name });
        router.refresh();
      },
    });
  };

  const deleteNoteAction = (note: Note) => {
    confirm({
      title: 'Delete note?',
      description: (
        <>
          <span className="font-medium">{note.title}</span> and its content will be permanently
          deleted. This cannot be undone.
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
    });
  };

  const deleteFolderAction = (folder: Folder, noteCount: number) => {
    const hasContent = noteCount > 0 || folders.some((f) => f.parentId === folder.id);
    confirm({
      title: hasContent ? `Delete "${folder.name}"?` : 'Delete folder?',
      description: hasContent ? (
        <>
          Subfolders inside this folder will also be deleted. Notes inside will be{' '}
          <span className="font-medium">moved to the root</span> (not deleted).
        </>
      ) : (
        <>The folder is empty. This cannot be undone.</>
      ),
      destructive: true,
      confirmLabel: 'Delete folder',
      confirmTypedText: hasContent ? folder.name : undefined,
      onConfirm: async () => {
        try {
          await deleteFolder(folder.id);
          router.refresh();
          toast.success('Folder deleted');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Delete failed');
        }
      },
    });
  };

  const toggleNoteFlag = async (
    note: Note,
    flag: 'isPinned' | 'isFavorite' | 'isArchived',
    nextValue: boolean,
  ) => {
    try {
      await updateNote({ id: note.id, [flag]: nextValue });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const duplicateNoteAction = async (note: Note) => {
    try {
      const copy = await duplicateNote(note.id);
      if (copy) {
        toast.success('Note duplicated');
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed');
    }
  };

  /* ----------------------------- Render ------------------------------ */

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mt-4 flex items-center justify-between px-3 pb-1">
        <h3 className="text-primary inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className="bg-primary/60 size-1 rounded-full" />
          Notes
        </h3>
        <div className="flex items-center gap-0.5">
          <EmbedStatusIndicator />
          <IconHeaderBtn
            aria-label="New folder"
            title="New folder"
            onClick={() => openNewFolder(null)}
          >
            <FolderPlus className="size-3.5" />
          </IconHeaderBtn>
          <IconHeaderBtn aria-label="New note" title="New note" onClick={() => openNewNote(null)}>
            <Plus className="size-3.5" />
          </IconHeaderBtn>
          <NewFromTemplateButton folderId={null} />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {/* Root as a big drop-area so dragging onto empty space moves to root. */}
          <RootDrop>
            <ul className="space-y-0.5">
              {tree.rootFolders.map((node) => (
                <FolderRow
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  pathname={pathname}
                  expanded={expanded}
                  onToggle={toggle}
                  onNewNote={openNewNote}
                  onNewFolder={openNewFolder}
                  onRenameFolder={renameFolderAction}
                  onDeleteFolder={deleteFolderAction}
                  onRenameNote={renameNoteAction}
                  onDeleteNote={deleteNoteAction}
                  onDuplicateNote={duplicateNoteAction}
                  onToggleFlag={toggleNoteFlag}
                />
              ))}
              {tree.rootNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  depth={0}
                  active={pathname === `/app/n/${note.id}`}
                  onRename={renameNoteAction}
                  onDelete={deleteNoteAction}
                  onDuplicate={duplicateNoteAction}
                  onToggleFlag={toggleNoteFlag}
                />
              ))}
            </ul>
          </RootDrop>
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="bg-popover pointer-events-none rounded-md border px-2 py-1.5 text-sm shadow-lg">
              {activeDrag.kind === 'note'
                ? (notes.find((n) => n.id === activeDrag.id)?.title ?? 'Note')
                : (folders.find((f) => f.id === activeDrag.id)?.name ?? 'Folder')}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SidebarBulkBar folders={folders} />

      {confirmDialog}
      {promptDialog}
    </div>
  );
}

/* ------------------- Drop-target index resolution ----------------------- */

function resolveTargetIndex(
  drop: DropTarget,
  folders: Folder[],
  notes: Note[],
  drag: DragId,
): { folderId: string | null; index?: number } {
  if (drop.kind === 'folder-contents') {
    return { folderId: drop.folderId };
  }
  // before/after another item — the target lives in the same folder as the item.
  const target = drop.draggable;
  if (target.kind === 'note') {
    const n = notes.find((x) => x.id === target.id);
    const folderId = n?.folderId ?? null;
    const siblings = notes
      .filter((x) => (x.folderId ?? null) === folderId && x.id !== drag.id)
      .sort((a, b) => a.position - b.position);
    const targetIdx = siblings.findIndex((x) => x.id === target.id);
    const index = drop.kind === 'before' ? targetIdx : targetIdx + 1;
    return { folderId, index };
  }
  // Dropping a note before/after a folder → same folder level, but notes
  // are rendered after folders, so "before the folder" still means "append
  // at the top of the notes list in that level". Simplest: append to end.
  const f = folders.find((x) => x.id === target.id);
  return { folderId: f?.parentId ?? null };
}

function resolveFolderTargetIndex(
  drop: DropTarget,
  folders: Folder[],
): { parentId: string | null; index?: number } {
  if (drop.kind === 'folder-contents') {
    return { parentId: drop.folderId };
  }
  const target = drop.draggable;
  if (target.kind === 'folder') {
    const f = folders.find((x) => x.id === target.id);
    const parentId = f?.parentId ?? null;
    const siblings = folders
      .filter((x) => (x.parentId ?? null) === parentId)
      .sort((a, b) => a.position - b.position);
    const targetIdx = siblings.findIndex((x) => x.id === target.id);
    const index = drop.kind === 'before' ? targetIdx : targetIdx + 1;
    return { parentId, index };
  }
  // Folder dropped onto a note position → move to that note's folder.
  return { parentId: null };
}

/* ----------------------------- Drop wrappers ---------------------------- */

function RootDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: encodeDrop({ kind: 'folder-contents', folderId: null }),
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[40px] rounded-md',
        isOver && 'bg-accent/40 ring-accent-foreground/20 ring-1',
      )}
    >
      {children}
    </div>
  );
}

function ReorderGap({ target, kind }: { target: DragId; kind: 'before' | 'after' }) {
  const { setNodeRef, isOver } = useDroppable({
    id: encodeDrop({ kind, draggable: target }),
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'pointer-events-auto -my-0.5 h-1 rounded-full transition-colors',
        isOver && 'bg-primary',
      )}
    />
  );
}

/* ------------------------------ Folder row ------------------------------ */

interface FolderRowProps {
  node: TreeNode;
  depth: number;
  pathname: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNewNote: (folderId: string | null) => void;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (f: Folder) => void;
  onDeleteFolder: (f: Folder, noteCount: number) => void;
  onRenameNote: (n: Note) => void;
  onDeleteNote: (n: Note) => void;
  onDuplicateNote: (n: Note) => void;
  onToggleFlag: (n: Note, flag: 'isPinned' | 'isFavorite' | 'isArchived', next: boolean) => void;
}

function FolderRow(props: FolderRowProps) {
  const {
    node,
    depth,
    pathname,
    expanded,
    onToggle,
    onNewNote,
    onNewFolder,
    onRenameFolder,
    onDeleteFolder,
    onRenameNote,
    onDeleteNote,
    onDuplicateNote,
    onToggleFlag,
  } = props;
  const isOpen = expanded.has(node.folder.id);
  const dragId: DragId = { kind: 'folder', id: node.folder.id };
  const [defaultTagsOpen, setDefaultTagsOpen] = React.useState(false);

  // Droppable: drop INTO this folder (makes it the parent)
  const { setNodeRef: setContentsRef, isOver: isOverContents } = useDroppable({
    id: encodeDrop({ kind: 'folder-contents', folderId: node.folder.id }),
  });

  // Draggable: this folder itself
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: encodeDrag(dragId),
  });

  const notesCount = node.notes.length;

  return (
    <li>
      <ReorderGap target={dragId} kind="before" />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={(el) => {
              setContentsRef(el);
              setDragRef(el);
            }}
            {...attributes}
            {...listeners}
            className={cn(
              'group flex cursor-pointer select-none items-center gap-1 rounded-md px-1.5 py-1 text-sm',
              'hover:bg-accent hover:text-accent-foreground',
              isOverContents && 'bg-accent/60 ring-primary/30 ring-1',
              isDragging && 'opacity-50',
            )}
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
            onClick={(e) => {
              // Don't toggle when clicking action buttons inside.
              if ((e.target as HTMLElement).closest('[data-stop-toggle]')) return;
              onToggle(node.folder.id);
            }}
          >
            <ChevronRight
              className={cn(
                'text-muted-foreground size-3.5 shrink-0 transition-transform',
                isOpen && 'rotate-90',
              )}
            />
            {isOpen ? (
              node.folder.icon ? (
                <span className="size-3.5 shrink-0 text-center text-xs leading-none">
                  {node.folder.icon}
                </span>
              ) : (
                <FolderOpen className="text-muted-foreground size-3.5 shrink-0" />
              )
            ) : node.folder.icon ? (
              <span className="size-3.5 shrink-0 text-center text-xs leading-none">
                {node.folder.icon}
              </span>
            ) : (
              <FolderIcon className="text-muted-foreground size-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{node.folder.name}</span>
            {notesCount > 0 && (
              <span className="text-muted-foreground text-[10px] tabular-nums">{notesCount}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={() => onNewNote(node.folder.id)}>
            <FilePlus2 className="size-4" /> New note here
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onNewFolder(node.folder.id)}>
            <FolderPlus className="size-4" /> New subfolder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onRenameFolder(node.folder)}>
            <Pencil className="size-4" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setDefaultTagsOpen(true)}>
            <Hash className="size-4" /> Default tags\u2026
          </ContextMenuItem>
          <ContextMenuSeparator />
          <div className="grid grid-cols-8 gap-1 px-2 py-1.5">
            {[
              '\ud83d\udcc1',
              '\ud83d\udcda',
              '\ud83d\udcdd',
              '\ud83d\udca1',
              '\ud83c\udfaf',
              '\ud83d\ude80',
              '\u2728',
              '\ud83d\udd25',
              '\ud83c\udf31',
              '\u2615',
              '\ud83d\udcbc',
              '\ud83c\udfa8',
              '\ud83d\udd2c',
              '\ud83c\udfae',
              '\u2764\ufe0f',
              '\u274c',
            ].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  void setFolderIcon({
                    id: node.folder.id,
                    icon: emoji === '\u274c' ? null : emoji,
                  });
                }}
                className={cn(
                  'hover:bg-muted flex size-6 items-center justify-center rounded text-sm',
                  node.folder.icon === emoji && 'bg-muted',
                )}
                title={emoji === '\u274c' ? 'Clear icon' : `Set icon to ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDeleteFolder(node.folder, notesCount)}
          >
            <Trash2 className="size-4" /> Delete folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <FolderDefaultTagsDialog
        folderId={node.folder.id}
        folderName={node.folder.name}
        open={defaultTagsOpen}
        onOpenChange={setDefaultTagsOpen}
      />

      {isOpen && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderRow key={child.folder.id} {...props} node={child} depth={depth + 1} />
          ))}
          {node.notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              depth={depth + 1}
              active={pathname === `/app/n/${note.id}`}
              onRename={onRenameNote}
              onDelete={onDeleteNote}
              onDuplicate={onDuplicateNote}
              onToggleFlag={onToggleFlag}
            />
          ))}
          {node.children.length === 0 && node.notes.length === 0 && (
            <li
              className="text-muted-foreground/60 pl-8 text-xs italic"
              style={{ paddingLeft: `${(depth + 1) * 12 + 22}px` }}
            >
              Empty folder
            </li>
          )}
        </ul>
      )}
      <ReorderGap target={dragId} kind="after" />
    </li>
  );
}

/* ------------------------------- Note row ------------------------------- */

interface NoteRowProps {
  note: Note;
  depth: number;
  active: boolean;
  onRename: (n: Note) => void;
  onDelete: (n: Note) => void;
  onDuplicate: (n: Note) => void;
  onToggleFlag: (n: Note, flag: 'isPinned' | 'isFavorite' | 'isArchived', next: boolean) => void;
}

function NoteRow({
  note,
  depth,
  active,
  onRename,
  onDelete,
  onDuplicate,
  onToggleFlag,
}: NoteRowProps) {
  const dragId: DragId = { kind: 'note', id: note.id };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: encodeDrag(dragId),
  });
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const selection = useSidebarSelection();
  const isSelected = selection.selected.has(note.id);

  const openAsSticky = async () => {
    try {
      const mod = await import('@/lib/tauri');
      if (mod.isTauri()) {
        await mod.invoke('open_sticky', { noteId: note.id });
        return;
      }
    } catch {
      /* fall through to browser */
    }
    window.open(`/sticky/${note.id}`, '_blank', 'popup=yes,width=360,height=480');
  };

  const exportMarkdown = async () => {
    try {
      const { filename, content } = await exportNoteMarkdown(note.id);
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Exported as Markdown');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const copyMarkdown = async () => {
    try {
      const { content } = await exportNoteMarkdown(note.id);
      await navigator.clipboard.writeText(content);
      toast.success('Copied note as Markdown');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Copy failed');
    }
  };

  const saveAsTemplate = async () => {
    const title = window.prompt('Template name', note.title || 'My template');
    if (!title) return;
    try {
      await createPersonalTemplate({ noteId: note.id, title });
      toast.success('Saved as personal template');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save template');
    }
  };

  const exportDoc = async () => {
    try {
      const { filename, content, mimeType } = await exportNoteDoc(note.id);
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Exported as Word document');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const exportPdf = async () => {
    try {
      const { content } = await exportNoteMarkdown(note.id);
      // Spawn a hidden iframe with a clean print-friendly layout, let
      // the browser's "Save as PDF" do the actual rendering. We don't
      // ship a markdown\u2192PDF library because every browser already has
      // a great one and the Print dialog is the universal escape hatch.
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${note.title || 'Untitled'}</title><style>
        body{font-family:ui-serif,Georgia,Cambria,'Times New Roman',Times,serif;font-size:12pt;line-height:1.55;max-width:680px;margin:24px auto;padding:0 16px;color:#111;}
        h1{font-size:22pt;margin:0 0 16px;font-weight:600;}
        pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;}
        @page{margin:18mm;}
      </style></head><body><pre>${content.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)}</pre></body></html>`;
      const doc = iframe.contentDocument;
      if (!doc) throw new Error('Print frame unavailable');
      doc.open();
      doc.write(html);
      doc.close();
      // Wait one tick for layout to settle.
      await new Promise((r) => setTimeout(r, 50));
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Browsers keep the iframe alive while the dialog is up; clean
      // up after a comfortable timeout.
      setTimeout(() => iframe.remove(), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Print failed');
    }
  };

  return (
    <li>
      <ReorderGap target={dragId} kind="before" />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={cn('relative', isDragging && 'opacity-50')}
          >
            <Link
              href={`/app/n/${note.id}`}
              onClick={(e) => {
                // In selection mode, clicking toggles selection instead
                // of navigating. Cmd/Ctrl-click also toggles even when
                // selection mode is off (entering it implicitly).
                if (selection.enabled) {
                  e.preventDefault();
                  selection.toggle(note.id);
                  return;
                }
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault();
                  selection.enable(note.id);
                }
              }}
              className={cn(
                'text-foreground/80 hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md',
                active && 'bg-accent text-accent-foreground',
                isSelected && 'ring-primary/40 bg-primary/5 ring-1',
              )}
              style={{
                paddingLeft: `${depth * 12 + 22}px`,
                paddingRight: '8px',
                paddingTop: 'var(--sidebar-row-pad-y, 0.375rem)',
                paddingBottom: 'var(--sidebar-row-pad-y, 0.375rem)',
                fontSize: 'var(--sidebar-row-text, 0.875rem)',
              }}
            >
              <SidebarSelectCheckbox noteId={note.id} className="-ml-1 shrink-0" />
              <span className="shrink-0 text-xs">{note.icon ?? '📝'}</span>
              <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled'}</span>
              {note.color && note.color !== 'default' && (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: noteColorSwatch(note.color) }}
                />
              )}
              {note.isPinned && <Pin className="text-muted-foreground size-3 shrink-0" />}
              {note.isFavorite && (
                <Star className="size-3 shrink-0 fill-yellow-500 text-yellow-500" />
              )}
            </Link>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onSelect={() => {
              if (selection.enabled) selection.toggle(note.id);
              else selection.enable(note.id);
            }}
          >
            <CheckSquare className="size-4" />{' '}
            {selection.enabled
              ? isSelected
                ? 'Deselect'
                : 'Add to selection'
              : 'Select multiple…'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onRename(note)}>
            <Pencil className="size-4" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onDuplicate(note)}>
            <Copy className="size-4" /> Duplicate
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setMergeOpen(true)}>
            <GitMerge className="size-4" /> Merge into\u2026
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <LayersIcon className="size-4" /> More
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52">
              <ContextMenuItem onSelect={openAsSticky}>
                <ExternalLink className="size-4" /> Open as sticky
              </ContextMenuItem>
              <ContextMenuItem onSelect={exportMarkdown}>
                <Download className="size-4" /> Export as Markdown
              </ContextMenuItem>
              <ContextMenuItem onSelect={copyMarkdown}>
                <ClipboardCopy className="size-4" /> Copy as Markdown
              </ContextMenuItem>
              <ContextMenuItem onSelect={exportPdf}>
                <Printer className="size-4" /> Print / Save as PDF
              </ContextMenuItem>
              <ContextMenuItem onSelect={exportDoc}>
                <Download className="size-4" /> Export as Word (.doc)
              </ContextMenuItem>
              <ContextMenuItem onSelect={saveAsTemplate}>
                <BookmarkPlus className="size-4" /> Save as template\u2026
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onToggleFlag(note, 'isPinned', !note.isPinned)}>
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
          <ContextMenuItem onSelect={() => onToggleFlag(note, 'isFavorite', !note.isFavorite)}>
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
          <ContextMenuItem onSelect={() => onToggleFlag(note, 'isArchived', !note.isArchived)}>
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
            onSelect={() => onDelete(note)}
          >
            <Trash2 className="size-4" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ReorderGap target={dragId} kind="after" />
      <NoteMergeDialog source={note} open={mergeOpen} onOpenChange={setMergeOpen} />
    </li>
  );
}

/* ------------------------------ Helpers --------------------------------- */

const NOTE_COLOR_SWATCHES: Record<string, string> = {
  amber: '#fde68a',
  rose: '#fecdd3',
  sky: '#bae6fd',
  emerald: '#a7f3d0',
  violet: '#ddd6fe',
  slate: '#cbd5e1',
};

function noteColorSwatch(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  return NOTE_COLOR_SWATCHES[color];
}

function IconHeaderBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-6 items-center justify-center rounded-md"
      {...rest}
    >
      {children}
    </button>
  );
}
