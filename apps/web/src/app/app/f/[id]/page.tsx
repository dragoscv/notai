import { notFound, redirect } from 'next/navigation';
import { Plus, Folder as FolderGlyph, Sparkles } from 'lucide-react';
import { listNotes, createNote } from '@/server/actions/notes';
import { getFolder, listFolders } from '@/server/actions/folders';
import { Button } from '@notai/ui/components/button';
import { NoteCardGrid } from '@/components/note/note-card-grid';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';
import { NoteIcon } from '@/components/ui/note-icon';

export const metadata = { title: 'Folder' };

/**
 * Folder page — shows all notes (direct children + descendants) belonging
 * to the given folder id. Layout mirrors the Today page so the experience
 * is consistent.
 */
export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [folder, allFolders, allNotes] = await Promise.all([
    getFolder(id),
    listFolders(),
    listNotes(),
  ]);
  if (!folder) notFound();

  // Collect descendant folder ids so a top-level folder shows everything
  // inside its subtree, not just direct children.
  const descendantIds = new Set<string>([folder.id]);
  let added = true;
  while (added) {
    added = false;
    for (const f of allFolders) {
      if (f.parentId && descendantIds.has(f.parentId) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        added = true;
      }
    }
  }

  const notesInFolder = allNotes.filter((n) => n.folderId && descendantIds.has(n.folderId));
  const pinned = notesInFolder.filter((n) => n.isPinned);
  const rest = notesInFolder.filter((n) => !n.isPinned);
  const subfolders = allFolders.filter((f) => f.parentId === folder.id);

  async function createHere(formData: FormData) {
    'use server';
    const kind = (formData.get('kind') as 'note' | 'sticky') ?? 'note';
    const note = await createNote({ kind, folderId: id });
    if (note) redirect(`/app/n/${note.id}`);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarToggle />
          <NoteIcon
            icon={folder.icon}
            className="size-5 shrink-0"
            fallback={<FolderGlyph className="text-muted-foreground size-5 shrink-0" />}
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{folder.name}</h1>
            <p className="text-muted-foreground truncate text-sm">
              {notesInFolder.length} note{notesInFolder.length === 1 ? '' : 's'}
              {subfolders.length > 0 &&
                ` · ${subfolders.length} subfolder${subfolders.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <form action={createHere} className="flex shrink-0 gap-2">
          <Button
            type="submit"
            name="kind"
            value="sticky"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Sparkles /> New sticky
          </Button>
          <Button
            type="submit"
            name="kind"
            value="sticky"
            variant="outline"
            size="icon-sm"
            className="sm:hidden"
            aria-label="New sticky"
          >
            <Sparkles />
          </Button>
          <Button
            type="submit"
            name="kind"
            value="note"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Plus /> New note
          </Button>
          <Button
            type="submit"
            name="kind"
            value="note"
            size="icon-sm"
            className="sm:hidden"
            aria-label="New note"
          >
            <Plus />
          </Button>
        </form>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {notesInFolder.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="mb-8">
                <h2 className="text-muted-foreground mb-3 text-sm font-medium">Pinned</h2>
                <NoteCardGrid notes={pinned} />
              </section>
            )}
            <section>
              <h2 className="text-muted-foreground mb-3 text-sm font-medium">All notes</h2>
              <NoteCardGrid notes={rest} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed py-20">
      <div className="text-center">
        <div className="bg-primary/10 text-primary mx-auto grid size-12 place-items-center rounded-full">
          <Plus />
        </div>
        <h3 className="mt-4 font-medium">This folder is empty</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a note inside this folder to get started.
        </p>
      </div>
    </div>
  );
}
