'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, FileText, Plus, Sparkles } from 'lucide-react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@notai/ui/components/command';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { createNote } from '@/server/actions/notes';
import type { Note } from '@notai/db/schema';

/**
 * App-wide command palette. Triggered with ⌘K or `notai:command-palette`.
 *
 * Visuals follow the app's warm aurora language: serif group headings,
 * a soft glass surface, and slightly larger touch targets so it feels
 * deliberate rather than utilitarian.
 */
export function CommandPalette({ notes }: { notes: Note[] }) {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    useHotkey('mod+k', () => setOpen((v) => !v));

    React.useEffect(() => {
        const onOpen = () => setOpen(true);
        document.addEventListener('notai:command-palette', onOpen);
        return () => document.removeEventListener('notai:command-palette', onOpen);
    }, []);

    const groupHeadingClass =
        '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-primary';

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            className="border bg-card/90 shadow-2xl shadow-foreground/10 backdrop-blur-xl sm:rounded-2xl"
        >
            <CommandInput placeholder="Search notes or type a command…" />
            <CommandList className="max-h-[360px] px-1 pb-2">
                <CommandEmpty>
                    <div className="px-4 py-8 text-center">
                        <p className="font-serif text-base">Nothing matches that yet.</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Try a different word, or start a new note.
                        </p>
                    </div>
                </CommandEmpty>

                <CommandGroup heading="Quick actions" className={groupHeadingClass}>
                    <CommandItem
                        onSelect={async () => {
                            setOpen(false);
                            const n = await createNote();
                            if (n) router.push(`/app/n/${n.id}`);
                        }}
                    >
                        <span className="grid size-7 place-items-center rounded-md bg-primary/15 text-primary">
                            <Plus className="size-3.5" />
                        </span>
                        <span>Create a new note</span>
                        <CommandShortcut>⌘N</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                        onSelect={async () => {
                            setOpen(false);
                            const n = await createNote({ kind: 'sticky' });
                            if (n) router.push(`/app/n/${n.id}?sticky=1`);
                        }}
                    >
                        <span className="grid size-7 place-items-center rounded-md bg-sticky-yellow text-foreground/70">
                            <Sparkles className="size-3.5" />
                        </span>
                        <span>Create a sticky note</span>
                    </CommandItem>
                </CommandGroup>

                {notes.length > 0 && (
                    <>
                        <CommandSeparator className="my-1" />
                        <CommandGroup heading="Your notes" className={groupHeadingClass}>
                            {notes.slice(0, 50).map((n) => (
                                <CommandItem
                                    key={n.id}
                                    value={`${n.title} ${n.plaintext}`}
                                    onSelect={() => {
                                        setOpen(false);
                                        router.push(`/app/n/${n.id}`);
                                    }}
                                >
                                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-base">
                                        {n.icon ?? <FileText className="size-3.5 text-muted-foreground" />}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-serif">
                                        {n.title || 'Untitled'}
                                    </span>
                                    <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground/60 opacity-0 group-data-[selected=true]:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>

            <div className="flex items-center justify-between gap-2 border-t bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                    <Hint kbd="↑↓">navigate</Hint>
                    <Hint kbd="↵">open</Hint>
                </div>
                <Hint kbd="esc">close</Hint>
            </div>
        </CommandDialog>
    );
}

function Hint({ kbd, children }: { kbd: string; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-card px-1 font-mono text-[10px] text-foreground/70">
                {kbd}
            </kbd>
            {children}
        </span>
    );
}
