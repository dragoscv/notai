'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Sparkles } from 'lucide-react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@notai/ui/components/command';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { createNote } from '@/server/actions/notes';
import type { Note } from '@notai/db/schema';

export function CommandPalette({ notes }: { notes: Note[] }) {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    useHotkey('mod+k', () => setOpen((v) => !v));

    React.useEffect(() => {
        const onOpen = () => setOpen(true);
        document.addEventListener('notai:command-palette', onOpen);
        return () => document.removeEventListener('notai:command-palette', onOpen);
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search notes or type a command…" />
            <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Actions">
                    <CommandItem
                        onSelect={async () => {
                            setOpen(false);
                            const n = await createNote();
                            if (n) router.push(`/app/n/${n.id}`);
                        }}
                    >
                        <Plus /> Create a new note
                    </CommandItem>
                    <CommandItem
                        onSelect={async () => {
                            setOpen(false);
                            const n = await createNote({ kind: 'sticky' });
                            if (n) router.push(`/app/n/${n.id}?sticky=1`);
                        }}
                    >
                        <Sparkles /> Create a sticky note
                    </CommandItem>
                </CommandGroup>
                {notes.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Notes">
                            {notes.slice(0, 50).map((n) => (
                                <CommandItem
                                    key={n.id}
                                    value={`${n.title} ${n.plaintext}`}
                                    onSelect={() => {
                                        setOpen(false);
                                        router.push(`/app/n/${n.id}`);
                                    }}
                                >
                                    <span>{n.icon ?? <FileText />}</span>
                                    <span className="truncate">{n.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}
