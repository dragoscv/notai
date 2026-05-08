'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, FileText, Loader2, Plus, Search, Sparkles } from 'lucide-react';
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
import { searchNotes, type SearchHit } from '@/server/actions/search';
import { AskDialog } from './ask-dialog';
import type { Note } from '@notai/db/schema';

/**
 * App-wide command palette. Triggered with ⌘K or `notai:command-palette`.
 *
 * For queries ≥ 2 chars we hit a server action that searches the user's
 * owned + shared notes via the trigram index, with title/plaintext rank
 * + recency boost. The cmdk built-in filter is disabled in that mode so
 * the server's ranking wins.
 */
export function CommandPalette({ notes }: { notes: Note[] }) {
  const [open, setOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const router = useRouter();

  useHotkey('mod+k', () => setOpen((v) => !v));
  useHotkey('mod+shift+k', () => setAskOpen((v) => !v));

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    document.addEventListener('notai:command-palette', onOpen);
    return () => document.removeEventListener('notai:command-palette', onOpen);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
    }
  }, [open]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchNotes(q)
        .then((rows) => {
          if (!cancelled) setHits(rows);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const groupHeadingClass =
    '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-primary';

  const showServerHits = query.trim().length >= 2;

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="bg-card/90 shadow-foreground/10 border shadow-2xl backdrop-blur-xl sm:rounded-2xl"
        shouldFilter={!showServerHits}
      >
        <CommandInput
          placeholder="Search notes or type a command…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[420px] px-1 pb-2">
          <CommandEmpty>
            <div className="px-4 py-8 text-center">
              <p className="font-serif text-base">Nothing matches that yet.</p>
              <p className="text-muted-foreground mt-1 text-xs">
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
              <span className="bg-primary/15 text-primary grid size-7 place-items-center rounded-md">
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
              <span className="bg-sticky-yellow text-foreground/70 grid size-7 place-items-center rounded-md">
                <Sparkles className="size-3.5" />
              </span>
              <span>Create a sticky note</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                setAskOpen(true);
              }}
            >
              <span className="grid size-7 place-items-center rounded-md bg-amber-500/15 text-amber-600">
                <Sparkles className="size-3.5" />
              </span>
              <span>Ask my notes…</span>
              <CommandShortcut>⌘⇧K</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                router.push('/app/trash');
              }}
            >
              <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                <Search className="size-3.5" />
              </span>
              <span>Open Trash</span>
            </CommandItem>
          </CommandGroup>

          {showServerHits ? (
            <>
              <CommandSeparator className="my-1" />
              <CommandGroup
                heading={searching ? 'Searching…' : `Results for "${query.trim()}"`}
                className={groupHeadingClass}
              >
                {searching && hits.length === 0 && (
                  <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
                    <Loader2 className="size-3.5 animate-spin" /> Looking through your notes
                  </div>
                )}
                {hits.map((h) => (
                  <CommandItem
                    key={h.id}
                    value={`${h.id}-${h.title}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/app/n/${h.id}`);
                    }}
                  >
                    <span className="bg-muted/70 grid size-7 shrink-0 place-items-center rounded-md text-base">
                      {h.icon ?? <FileText className="text-muted-foreground size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif">{h.title || 'Untitled'}</p>
                      {h.snippet && (
                        <p className="text-muted-foreground truncate text-xs">
                          <Highlight text={h.snippet} match={query.trim()} />
                        </p>
                      )}
                    </div>
                    <CornerDownLeft className="text-muted-foreground/60 size-3.5 shrink-0" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : (
            notes.length > 0 && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading="Recent" className={groupHeadingClass}>
                  {notes.slice(0, 12).map((n) => (
                    <CommandItem
                      key={n.id}
                      value={`${n.title} ${n.plaintext}`}
                      onSelect={() => {
                        setOpen(false);
                        router.push(`/app/n/${n.id}`);
                      }}
                    >
                      <span className="bg-muted/70 grid size-7 shrink-0 place-items-center rounded-md text-base">
                        {n.icon ?? <FileText className="text-muted-foreground size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-serif">
                        {n.title || 'Untitled'}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )
          )}
        </CommandList>

        <div className="bg-background/40 text-muted-foreground flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px]">
          <div className="flex items-center gap-3">
            <Hint kbd="↑↓">navigate</Hint>
            <Hint kbd="↵">open</Hint>
          </div>
          <Hint kbd="esc">close</Hint>
        </div>
      </CommandDialog>
      <AskDialog open={askOpen} onOpenChange={setAskOpen} />
    </>
  );
}

function Hint({ kbd, children }: { kbd: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="bg-card text-foreground/70 rounded border px-1 font-mono text-[10px]">
        {kbd}
      </kbd>
      {children}
    </span>
  );
}

function Highlight({ text, match }: { text: string; match: string }) {
  if (!match) return <>{text}</>;
  const escaped = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === match.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
