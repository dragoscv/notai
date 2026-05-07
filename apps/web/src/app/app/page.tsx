import { Plus, Pin, Sparkles } from 'lucide-react';
import { listNotes, createNote } from '@/server/actions/notes';
import { Button } from '@notai/ui/components/button';
import { NoteCardGrid } from '@/components/note/note-card-grid';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Home' };

export default async function AppHome() {
    const notes = await listNotes();
    const pinned = notes.filter((n) => n.isPinned);
    const recent = notes.filter((n) => !n.isPinned).slice(0, 12);

    async function createAndOpen(formData: FormData) {
        'use server';
        const kind = (formData.get('kind') as 'note' | 'sticky') ?? 'note';
        const note = await createNote({ kind });
        if (note) redirect(`/app/n/${note.id}`);
    }

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center justify-between gap-2 border-b px-4 py-3 md:px-6 md:py-4">
                <div className="flex min-w-0 items-center gap-2">
                    <SidebarToggle />
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-semibold tracking-tight">Today</h1>
                        <p className="truncate text-sm text-muted-foreground">
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
                <form action={createAndOpen} className="flex shrink-0 gap-2">
                    <Button type="submit" name="kind" value="sticky" variant="outline" size="sm" className="hidden sm:inline-flex">
                        <Sparkles /> New sticky
                    </Button>
                    <Button type="submit" name="kind" value="sticky" variant="outline" size="icon-sm" className="sm:hidden" aria-label="New sticky">
                        <Sparkles />
                    </Button>
                    <Button type="submit" name="kind" value="note" size="sm" className="hidden sm:inline-flex">
                        <Plus /> New note
                    </Button>
                    <Button type="submit" name="kind" value="note" size="icon-sm" className="sm:hidden" aria-label="New note">
                        <Plus />
                    </Button>
                </form>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {pinned.length > 0 && (
                    <section className="mb-8">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Pin className="size-3.5" /> Pinned
                        </h2>
                        <NoteCardGrid notes={pinned} />
                    </section>
                )}

                <section>
                    <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent</h2>
                    {recent.length === 0 && pinned.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <NoteCardGrid notes={recent} />
                    )}
                </section>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="grid place-items-center rounded-xl border border-dashed py-20">
            <div className="text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <Plus />
                </div>
                <h3 className="mt-4 font-medium">No notes yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">N</kbd> to create
                    your first note.
                </p>
            </div>
        </div>
    );
}
