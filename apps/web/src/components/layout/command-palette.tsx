'use client';
import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  CornerDownLeft,
  FileText,
  Inbox,
  CalendarDays,
  Sun,
  Loader2,
  Network,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Link as LinkIcon,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { searchNotes, searchNotesHybrid, type SearchHit } from '@/server/actions/search';
import {
  listSavedSearches,
  saveSavedSearch,
  deleteSavedSearch,
  type SavedSearch,
} from '@/server/actions/saved-searches';
import { summariseUrl } from '@/server/actions/smart-paste';
import { summarizeNote, extractActionItems, rewriteForClarity } from '@/server/actions/ai-actions';
import { suggestTagsForNote } from '@/server/actions/tags';
import { getThrowbackNote } from '@/server/actions/throwback';
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
  const [hoveredHitId, setHoveredHitId] = React.useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = React.useState(false);
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [stickiesOnly, setStickiesOnly] = React.useState(false);
  const [semanticOn, setSemanticOn] = React.useState(false);
  const [savedSearches, setSavedSearches] = React.useState<SavedSearch[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  // Pull the active note id off the URL so AI actions can target it
  // without prop drilling. Matches `/app/n/<id>` and `/app/n/<id>/...`.
  const activeNoteId = React.useMemo(() => {
    const m = pathname?.match(/^\/app\/n\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]!) : null;
  }, [pathname]);

  useHotkey('mod+k', () => setOpen((v) => !v), { id: 'command-palette' });
  useHotkey('mod+shift+k', () => setAskOpen((v) => !v));

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    document.addEventListener('notai:command-palette', onOpen);
    return () => document.removeEventListener('notai:command-palette', onOpen);
  }, []);

  // Refresh saved searches whenever the palette opens — cheap query,
  // and keeps the list in sync if the user saved one in another tab.
  React.useEffect(() => {
    if (!open) return;
    void listSavedSearches()
      .then((rows) => setSavedSearches(rows))
      .catch(() => undefined);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
      setHoveredHitId(null);
      setPinnedOnly(false);
      setFavoritesOnly(false);
      setStickiesOnly(false);
      setSemanticOn(false);
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
      const fn = semanticOn ? searchNotesHybrid : searchNotes;
      fn(q, { pinnedOnly, favoritesOnly, stickiesOnly })
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
  }, [query, pinnedOnly, favoritesOnly, stickiesOnly, semanticOn]);

  const groupHeadingClass =
    '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-primary';

  const showServerHits = query.trim().length >= 2;

  const hoveredPreview = React.useMemo(
    () => (hoveredHitId ? (hits.find((h) => h.id === hoveredHitId) ?? null) : null),
    [hoveredHitId, hits],
  );

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
        />{' '}
        {showServerHits && (
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
            <button
              type="button"
              onClick={() => setPinnedOnly((v) => !v)}
              className={
                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition ' +
                (pinnedOnly
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:bg-accent')
              }
              aria-pressed={pinnedOnly}
            >
              \ud83d\udccc Pinned
            </button>
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={
                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition ' +
                (favoritesOnly
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:bg-accent')
              }
              aria-pressed={favoritesOnly}
            >
              \u2b50 Favorites
            </button>
            <button
              type="button"
              onClick={() => setStickiesOnly((v) => !v)}
              className={
                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition ' +
                (stickiesOnly
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:bg-accent')
              }
              aria-pressed={stickiesOnly}
            >
              \ud83d\uddc2\ufe0f Stickies
            </button>
            <button
              type="button"
              onClick={() => setSemanticOn((v) => !v)}
              className={
                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition ' +
                (semanticOn
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:bg-accent')
              }
              aria-pressed={semanticOn}
              title="Hybrid search: trigram + pgvector. Slower, but finds notes by meaning."
            >
              \u2728 Semantic
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt('Name this saved search:', query.trim().slice(0, 40));
                if (!name?.trim()) return;
                try {
                  await saveSavedSearch({
                    name: name.trim(),
                    filters: {
                      query: query.trim(),
                      semanticOn,
                      pinnedOnly,
                      favoritesOnly,
                      stickiesOnly,
                    },
                  });
                  toast.success(`Saved "${name.trim()}"`);
                  const rows = await listSavedSearches();
                  setSavedSearches(rows);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not save search');
                }
              }}
              className="text-muted-foreground hover:bg-accent ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium transition"
              title="Save this query + filters as a reusable search"
            >
              \ud83d\udcbe Save
            </button>
          </div>
        )}{' '}
        <CommandList className="max-h-[420px] px-1 pb-2">
          <CommandEmpty>
            <div className="px-4 py-8 text-center">
              <p className="font-serif text-base">Nothing matches that yet.</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Try a different word, or start a new note.
              </p>
            </div>
          </CommandEmpty>

          {!showServerHits && savedSearches.length > 0 && (
            <CommandGroup heading="Saved searches" className={groupHeadingClass}>
              {savedSearches.map((s) => (
                <CommandItem
                  key={s.id}
                  onSelect={() => {
                    setQuery(s.filters.query);
                    setSemanticOn(s.filters.semanticOn);
                    setPinnedOnly(s.filters.pinnedOnly);
                    setFavoritesOnly(s.filters.favoritesOnly);
                    setStickiesOnly(s.filters.stickiesOnly);
                  }}
                >
                  <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                    <Search className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <button
                    type="button"
                    aria-label={`Delete saved search ${s.name}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await deleteSavedSearch(s.id);
                        setSavedSearches((rows) => rows.filter((r) => r.id !== s.id));
                      } catch {
                        toast.error('Could not delete');
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground ml-2 text-xs"
                  >
                    \u00d7
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {activeNoteId && (
            <CommandGroup heading="Current note (AI)" className={groupHeadingClass}>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runAiOnNote('Summarising note…', () => summarizeNote(activeNoteId));
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-fuchsia-500/15 text-fuchsia-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>Summarise this note</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runAiOnNote('Extracting tasks…', () => extractActionItems(activeNoteId));
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-emerald-500/15 text-emerald-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>Extract action items</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runAiOnNote('Rewriting for clarity…', () => rewriteForClarity(activeNoteId));
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-sky-500/15 text-sky-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>Rewrite for clarity</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runSuggestTags(activeNoteId);
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-amber-500/15 text-amber-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>Suggest tags</span>
              </CommandItem>
            </CommandGroup>
          )}

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
                router.push('/app/graph');
              }}
            >
              <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                <Network className="size-3.5" />
              </span>
              <span>Open note graph</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                router.push('/app/templates');
              }}
            >
              <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                <LayoutGrid className="size-3.5" />
              </span>
              <span>Browse templates</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                void summariseClipboardUrl(router);
              }}
            >
              <span className="grid size-7 place-items-center rounded-md bg-amber-500/15 text-amber-600">
                <LinkIcon className="size-3.5" />
              </span>
              <span>Summarise URL from clipboard…</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                void randomRecall(router);
              }}
            >
              <span className="grid size-7 place-items-center rounded-md bg-violet-500/15 text-violet-600">
                <Shuffle className="size-3.5" />
              </span>
              <span>Random recall — jump to a forgotten note</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                router.push('/app/inbox-zero');
              }}
            >
              <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                <Inbox className="size-3.5" />
              </span>
              <span>Inbox Zero — file unfiled notes</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                router.push('/app/calendar');
              }}
            >
              <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                <CalendarDays className="size-3.5" />
              </span>
              <span>Calendar — browse notes by day</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                router.push('/app/today');
              }}
            >
              <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                <Sun className="size-3.5" />
              </span>
              <span>Today’s daily note (⌘J)</span>
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
                    onMouseEnter={() => setHoveredHitId(h.id)}
                    onFocus={() => setHoveredHitId(h.id)}
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
        {showServerHits && hits.length > 0 && hoveredPreview && (
          <div className="bg-background/60 border-t px-3 py-2.5">
            <div className="mb-1 flex items-center gap-2">
              <span className="bg-muted/70 grid size-5 shrink-0 place-items-center rounded text-[11px]">
                {hoveredPreview.icon ?? <FileText className="text-muted-foreground size-3" />}
              </span>
              <p className="truncate font-serif text-sm">{hoveredPreview.title || 'Untitled'}</p>
            </div>
            <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">
              <Highlight
                text={hoveredPreview.preview || hoveredPreview.snippet}
                match={query.trim()}
              />
            </p>
          </div>
        )}
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

const URL_RE = /^https?:\/\/\S+$/;

/**
 * Run an AI action against the active note and copy the result to the
 * clipboard. We deliberately don't auto-insert into the canvas — the
 * user gets to read the output, decide, and paste it where they want.
 * That keeps the destructive surface area zero.
 */
async function runAiOnNote(loadingMsg: string, fn: () => Promise<string>): Promise<void> {
  const t = toast.loading(loadingMsg);
  try {
    const out = (await fn()).trim();
    if (!out) {
      toast.error('AI returned no content', { id: t });
      return;
    }
    await navigator.clipboard.writeText(out).catch(() => undefined);
    toast.success('Result copied to clipboard', {
      id: t,
      description: out.length > 120 ? out.slice(0, 117) + '…' : out,
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'AI action failed', { id: t });
  }
}

async function runSuggestTags(noteId: string): Promise<void> {
  const t = toast.loading('Suggesting tags…');
  try {
    const tags = await suggestTagsForNote(noteId);
    if (!tags.length) {
      toast.message('No tag suggestions for this note', { id: t });
      return;
    }
    await navigator.clipboard
      .writeText(tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' '))
      .catch(() => undefined);
    toast.success(`Copied ${tags.length} tag${tags.length === 1 ? '' : 's'}`, {
      id: t,
      description: tags.slice(0, 6).join(', '),
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to suggest tags', { id: t });
  }
}

/**
 * Pull a URL from the clipboard, fetch + summarise it, then create a
 * fresh note pre-populated with the captioned summary via the shared
 * `notai:pending-append` handoff. Wired to the command palette's
 * "Summarise URL from clipboard…" entry.
 */
async function summariseClipboardUrl(router: ReturnType<typeof useRouter>): Promise<void> {
  let raw = '';
  try {
    raw = (await navigator.clipboard.readText()).trim();
  } catch {
    toast.error('Clipboard access denied. Copy a URL and try again.');
    return;
  }
  if (!URL_RE.test(raw)) {
    toast.error('No URL on the clipboard. Copy an https:// link first.');
    return;
  }
  try {
    new URL(raw);
  } catch {
    toast.error('That clipboard text is not a valid URL.');
    return;
  }

  const t = toast.loading('Summarising link\u2026');
  try {
    const res = await summariseUrl({ url: raw });
    const heading = res.title?.trim() || res.host;
    const body = [
      `## ${heading}`,
      res.summary?.trim() ? res.summary.trim() : '_(no summary available)_',
      '',
      `Source: ${res.url}`,
    ].join('\n\n');

    const note = await createNote({ title: heading.slice(0, 200), icon: '\uD83D\uDD17' });
    if (!note) throw new Error('Failed to create note');

    try {
      window.localStorage.setItem(
        'notai:pending-append',
        JSON.stringify({ noteId: note.id, text: body, ts: Date.now() }),
      );
    } catch {
      /* localStorage disabled \u2014 the note still opens, just without the body */
    }

    toast.success('Note created', { id: t });
    router.push(`/app/n/${note.id}`);
  } catch (err) {
    toast.error((err as Error).message, { id: t });
  }
}

/**
 * Pick one note the user hasn't touched in 30+ days and jump straight
 * to it. Same data source as the dashboard Throwback card; this is
 * just a one-shot navigation entry point. Silent toast when no
 * archive exists yet (first-week users).
 */
async function randomRecall(router: ReturnType<typeof useRouter>): Promise<void> {
  const t = toast.loading('Picking a note\u2026');
  try {
    const note = await getThrowbackNote();
    if (!note) {
      toast.message('Nothing old enough yet \u2014 keep writing.', { id: t });
      return;
    }
    toast.success(note.title || 'Untitled', { id: t });
    router.push(`/app/n/${note.id}`);
  } catch (err) {
    toast.error((err as Error).message, { id: t });
  }
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
