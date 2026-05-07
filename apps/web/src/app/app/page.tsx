import { Pin, PenLine, Plus, Sparkles, StickyNote } from 'lucide-react';
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
    const isEmpty = pinned.length === 0 && recent.length === 0;

    async function createAndOpen(formData: FormData) {
        'use server';
        const kind = (formData.get('kind') as 'note' | 'sticky') ?? 'note';
        const note = await createNote({ kind });
        if (note) redirect(`/app/n/${note.id}`);
    }

    const today = new Date();
    const weekday = today.toLocaleDateString(undefined, { weekday: 'long' });
    const dateLabel = today.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center justify-between gap-2 border-b bg-background/70 px-4 py-3 backdrop-blur md:px-6 md:py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <SidebarToggle />
                    <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/20"
                    >
                        <PenLine className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate font-serif text-xl font-semibold tracking-tight md:text-2xl">
                            {weekday}
                        </h1>
                        <p className="truncate text-xs text-muted-foreground md:text-sm">
                            {dateLabel} · {pluralize(notes.length, 'note')}
                        </p>
                    </div>
                </div>
                <form action={createAndOpen} className="flex shrink-0 gap-2">
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
                        className="hidden shadow-sm shadow-primary/20 sm:inline-flex"
                    >
                        <Plus /> New note
                    </Button>
                    <Button
                        type="submit"
                        name="kind"
                        value="note"
                        size="icon-sm"
                        className="shadow-sm shadow-primary/20 sm:hidden"
                        aria-label="New note"
                    >
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
                    {!isEmpty && (
                        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent</h2>
                    )}
                    {isEmpty ? <EmptyState /> : <NoteCardGrid notes={recent} />}
                </section>
            </div>
        </div>
    );
}

function pluralize(n: number, word: string) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function EmptyState() {
    return (
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border bg-card/60 p-10 text-center backdrop-blur">
            {/* subtle warm wash */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                    background:
                        'radial-gradient(600px 300px at 50% -10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%)',
                }}
            />

            {/* sticky note collage */}
            <div className="relative mx-auto mb-8 h-40 w-72">
                <div className="absolute -left-2 top-2 w-44 rotate-[-7deg] rounded-md bg-sticky-yellow p-3 text-left text-[12px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                    <div className="mb-1 flex items-center gap-1 text-[9px] font-medium tracking-wide text-foreground/50 uppercase">
                        <Pin className="size-2.5" /> idea
                    </div>
                    What should I write first?
                </div>
                <div className="absolute right-0 top-1 w-40 rotate-[6deg] rounded-md bg-sticky-pink p-3 text-left text-[12px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                    <div className="mb-1 text-[9px] font-medium tracking-wide text-foreground/50 uppercase">
                        Today
                    </div>
                    Morning coffee · Plan the week ☕
                </div>
                <div className="absolute -bottom-1 left-12 w-44 rotate-[-3deg] rounded-md bg-sticky-blue p-3 text-left text-[12px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                    <div className="mb-1 text-[9px] font-medium tracking-wide text-foreground/50 uppercase">
                        Sketch
                    </div>
                    Doodle something just for fun ✏️
                </div>
            </div>

            <div className="relative">
                <p className="text-xs font-medium tracking-wider text-primary uppercase">
                    Your notebook is fresh
                </p>
                <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
                    Start with a single thought.
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Press{' '}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">N</kbd> to
                    create your first note, or pin a quick sticky to keep something on your mind.
                </p>

                <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                    <NewNoteAction kind="note" label="Create your first note" icon={<PenLine />} />
                    <NewNoteAction
                        kind="sticky"
                        label="Add a sticky"
                        icon={<StickyNote />}
                        variant="outline"
                    />
                </div>
            </div>
        </div>
    );
}

function NewNoteAction({
    kind,
    label,
    icon,
    variant = 'default',
}: {
    kind: 'note' | 'sticky';
    label: string;
    icon: React.ReactNode;
    variant?: 'default' | 'outline';
}) {
    async function action() {
        'use server';
        const note = await createNote({ kind });
        if (note) redirect(`/app/n/${note.id}`);
    }
    return (
        <form action={action}>
            <Button
                type="submit"
                size="lg"
                variant={variant}
                className={variant === 'default' ? 'shadow-lg shadow-primary/20' : ''}
            >
                {icon} {label}
            </Button>
        </form>
    );
}
