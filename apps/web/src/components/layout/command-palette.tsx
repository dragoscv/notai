'use client';
import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
 * In-memory LRU cache of recent search results keyed by the full
 * query+filter signature. Lives at module scope so it survives
 * palette close / reopen and reuses results across tab focus
 * cycles, without ever leaking outside the renderer process.
 */
const SEARCH_CACHE_MAX = 24;
const searchCache = new Map<string, { hits: SearchHit[]; ts: number }>();

function cacheKey(
  q: string,
  filters: { pinned: boolean; fav: boolean; stickies: boolean; semantic: boolean },
): string {
  return `${q}|${filters.pinned ? 1 : 0}|${filters.fav ? 1 : 0}|${filters.stickies ? 1 : 0}|${filters.semantic ? 1 : 0}`;
}

function cacheGet(key: string): SearchHit[] | null {
  const hit = searchCache.get(key);
  if (!hit) return null;
  // Expire after 60s — fresh enough to feel live, long enough to
  // make typing-backspace-retype feel free.
  if (Date.now() - hit.ts > 60_000) {
    searchCache.delete(key);
    return null;
  }
  // Refresh LRU order.
  searchCache.delete(key);
  searchCache.set(key, hit);
  return hit.hits;
}

function cachePut(key: string, hits: SearchHit[]): void {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(key, { hits, ts: Date.now() });
}

const RECENT_KEY = 'notai:cmdk:recent';
const RECENT_MAX = 8;

function loadRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function pushRecentSearch(q: string): string[] {
  const trimmed = q.trim();
  if (trimmed.length < 2) return loadRecentSearches();
  const current = loadRecentSearches().filter((s) => s !== trimmed);
  const next = [trimmed, ...current].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private-mode errors
  }
  return next;
}

/**
 * App-wide command palette. Triggered with ⌘K or `notai:command-palette`.
 *
 * For queries ≥ 2 chars we hit a server action that searches the user's
 * owned + shared notes via the trigram index, with title/plaintext rank
 * + recency boost. The cmdk built-in filter is disabled in that mode so
 * the server's ranking wins.
 */
export function CommandPalette({ notes }: { notes: Note[] }) {
  const t = useTranslations('commandPalette');
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
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
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
    setRecentSearches(loadRecentSearches());
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
    const key = cacheKey(q, {
      pinned: pinnedOnly,
      fav: favoritesOnly,
      stickies: stickiesOnly,
      semantic: semanticOn,
    });
    const cached = cacheGet(key);
    if (cached) {
      // Instant return for repeat queries — most useful when the user
      // backspaces a character and retypes it, or revisits the same
      // search across tab focus.
      setHits(cached);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      const fn = semanticOn ? searchNotesHybrid : searchNotes;
      fn(q, { pinnedOnly, favoritesOnly, stickiesOnly })
        .then((rows) => {
          if (cancelled) return;
          cachePut(key, rows);
          setHits(rows);
          if (rows.length > 0) setRecentSearches(pushRecentSearch(q));
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
          placeholder={t('dialog.placeholder')}
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
              {t('dialog.filters.pinned')}
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
              {t('dialog.filters.favorites')}
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
              {t('dialog.filters.stickies')}
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
              title={t('dialog.filters.semanticTitle')}
            >
              {t('dialog.filters.semantic')}
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt(
                  t('dialog.filters.savePrompt'),
                  query.trim().slice(0, 40),
                );
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
                  toast.success(t('dialog.filters.saveSuccess', { name: name.trim() }));
                  const rows = await listSavedSearches();
                  setSavedSearches(rows);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t('dialog.filters.saveError'));
                }
              }}
              className="text-muted-foreground hover:bg-accent ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium transition"
              title={t('dialog.filters.saveTitle')}
            >
              {t('dialog.filters.save')}
            </button>
          </div>
        )}{' '}
        <CommandList className="max-h-[420px] px-1 pb-2">
          <CommandEmpty>
            <div className="px-4 py-8 text-center">
              <p className="font-serif text-base">{t('dialog.emptyTitle')}</p>
              <p className="text-muted-foreground mt-1 text-xs">{t('dialog.emptyHint')}</p>
            </div>
          </CommandEmpty>

          {!showServerHits && recentSearches.length > 0 && (
            <CommandGroup heading={t('groups.recentSearches')} className={groupHeadingClass}>
              {recentSearches.map((q) => (
                <CommandItem key={`recent-${q}`} onSelect={() => setQuery(q)}>
                  <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                    <Search className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{q}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!showServerHits && savedSearches.length > 0 && (
            <CommandGroup heading={t('groups.savedSearches')} className={groupHeadingClass}>
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
                    aria-label={t('dialog.filters.deleteSavedAria', { name: s.name })}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await deleteSavedSearch(s.id);
                        setSavedSearches((rows) => rows.filter((r) => r.id !== s.id));
                      } catch {
                        toast.error(t('dialog.filters.deleteError'));
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
            <CommandGroup heading={t('groups.currentNoteAi')} className={groupHeadingClass}>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runAiOnNote(
                    t('actions.summariseLoading'),
                    () => summarizeNote(activeNoteId),
                    t,
                  );
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-fuchsia-500/15 text-fuchsia-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>{t('actions.summarise')}</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runAiOnNote(
                    t('actions.extractActionsLoading'),
                    () => extractActionItems(activeNoteId),
                    t,
                  );
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-emerald-500/15 text-emerald-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>{t('actions.extractActions')}</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runAiOnNote(
                    t('actions.rewriteLoading'),
                    () => rewriteForClarity(activeNoteId),
                    t,
                  );
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-sky-500/15 text-sky-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>{t('actions.rewrite')}</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  void runSuggestTags(activeNoteId, t);
                }}
              >
                <span className="grid size-7 place-items-center rounded-md bg-amber-500/15 text-amber-600">
                  <Sparkles className="size-3.5" />
                </span>
                <span>{t('actions.suggestTags')}</span>
              </CommandItem>
            </CommandGroup>
          )}

          <CommandGroup heading={t('groups.quickActions')} className={groupHeadingClass}>
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
              <span>{t('actions.newNote')}</span>
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
              <span>{t('actions.newSticky')}</span>
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
              <span>{t('actions.ask')}</span>
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
              <span>{t('actions.openGraph')}</span>
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
              <span>{t('actions.browseTemplates')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                void summariseClipboardUrl(router, t);
              }}
            >
              <span className="grid size-7 place-items-center rounded-md bg-amber-500/15 text-amber-600">
                <LinkIcon className="size-3.5" />
              </span>
              <span>{t('actions.summariseClipboard')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                void randomRecall(router, t);
              }}
            >
              <span className="grid size-7 place-items-center rounded-md bg-violet-500/15 text-violet-600">
                <Shuffle className="size-3.5" />
              </span>
              <span>{t('actions.randomRecall')}</span>
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
              <span>{t('actions.inboxZero')}</span>
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
              <span>{t('actions.calendar')}</span>
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
              <span>{t('actions.today')}</span>
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
              <span>{t('actions.openTrash')}</span>
            </CommandItem>
          </CommandGroup>

          {showServerHits ? (
            <>
              <CommandSeparator className="my-1" />
              <CommandGroup
                heading={
                  searching
                    ? t('dialog.searching')
                    : t('dialog.resultsFor', { query: query.trim() })
                }
                className={groupHeadingClass}
              >
                {searching && hits.length === 0 && (
                  <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
                    <Loader2 className="size-3.5 animate-spin" /> {t('dialog.lookingThrough')}
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
                      <p className="truncate font-serif">{h.title || t('dialog.untitled')}</p>
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
                <CommandGroup heading={t('groups.recent')} className={groupHeadingClass}>
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
                        {n.title || t('dialog.untitled')}
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
              <p className="truncate font-serif text-sm">
                {hoveredPreview.title || t('dialog.untitled')}
              </p>
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
            <Hint kbd="↑↓">{t('dialog.hints.navigate')}</Hint>
            <Hint kbd="↵">{t('dialog.hints.open')}</Hint>
          </div>
          <Hint kbd="esc">{t('dialog.hints.close')}</Hint>
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
async function runAiOnNote(
  loadingMsg: string,
  fn: () => Promise<string>,
  t: (key: string) => string,
): Promise<void> {
  const tt = toast.loading(loadingMsg);
  try {
    const out = (await fn()).trim();
    if (!out) {
      toast.error(t('actions.aiNoContent'), { id: tt });
      return;
    }
    await navigator.clipboard.writeText(out).catch(() => undefined);
    toast.success(t('actions.aiCopied'), {
      id: tt,
      description: out.length > 120 ? out.slice(0, 117) + '…' : out,
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('actions.aiActionFailed'), { id: tt });
  }
}

async function runSuggestTags(
  noteId: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): Promise<void> {
  const tt = toast.loading(t('actions.suggestTagsLoading'));
  try {
    const tags = await suggestTagsForNote(noteId);
    if (!tags.length) {
      toast.message(t('actions.suggestTagsEmpty'), { id: tt });
      return;
    }
    await navigator.clipboard
      .writeText(tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' '))
      .catch(() => undefined);
    const msg =
      tags.length === 1
        ? t('actions.suggestTagsCopiedOne')
        : t('actions.suggestTagsCopiedOther', { count: tags.length });
    toast.success(msg, {
      id: tt,
      description: tags.slice(0, 6).join(', '),
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('actions.suggestTagsError'), { id: tt });
  }
}

/**
 * Pull a URL from the clipboard, fetch + summarise it, then create a
 * fresh note pre-populated with the captioned summary via the shared
 * `notai:pending-append` handoff. Wired to the command palette's
 * "Summarise URL from clipboard…" entry.
 */
async function summariseClipboardUrl(
  router: ReturnType<typeof useRouter>,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): Promise<void> {
  let raw = '';
  try {
    raw = (await navigator.clipboard.readText()).trim();
  } catch {
    toast.error(t('actions.clipboardDenied'));
    return;
  }
  if (!URL_RE.test(raw)) {
    toast.error(t('actions.clipboardNoUrl'));
    return;
  }
  try {
    new URL(raw);
  } catch {
    toast.error(t('actions.clipboardInvalidUrl'));
    return;
  }

  const tt = toast.loading(t('actions.summariseLinkLoading'));
  try {
    const res = await summariseUrl({ url: raw });
    const heading = res.title?.trim() || res.host;
    const body = [
      `## ${heading}`,
      res.summary?.trim() ? res.summary.trim() : t('actions.summariseNoSummary'),
      '',
      t('actions.summariseSource', { url: res.url }),
    ].join('\n\n');

    const note = await createNote({ title: heading.slice(0, 200), icon: '\uD83D\uDD17' });
    if (!note) throw new Error(t('actions.summariseCreateFailed'));

    try {
      window.localStorage.setItem(
        'notai:pending-append',
        JSON.stringify({ noteId: note.id, text: body, ts: Date.now() }),
      );
    } catch {
      /* localStorage disabled — the note still opens, just without the body */
    }

    toast.success(t('actions.summariseSuccess'), { id: tt });
    router.push(`/app/n/${note.id}`);
  } catch (err) {
    toast.error((err as Error).message, { id: tt });
  }
}

/**
 * Pick one note the user hasn't touched in 30+ days and jump straight
 * to it. Same data source as the dashboard Throwback card; this is
 * just a one-shot navigation entry point. Silent toast when no
 * archive exists yet (first-week users).
 */
async function randomRecall(
  router: ReturnType<typeof useRouter>,
  t: (key: string) => string,
): Promise<void> {
  const tt = toast.loading(t('actions.recallLoading'));
  try {
    const note = await getThrowbackNote();
    if (!note) {
      toast.message(t('actions.recallEmpty'), { id: tt });
      return;
    }
    toast.success(note.title || t('dialog.untitled'), { id: tt });
    router.push(`/app/n/${note.id}`);
  } catch (err) {
    toast.error((err as Error).message, { id: tt });
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
