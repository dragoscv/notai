'use client';
import * as React from 'react';
import { Hash, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  attachTag,
  detachTag,
  listNoteTags,
  listTags,
  suggestTagsForNote,
} from '@/server/actions/tags';

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

const COLORS = [
  'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  'bg-rose-500/15 text-rose-700 dark:text-rose-400',
];

function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

/**
 * Chip-input tag editor. Lives near the title in the note workspace so
 * tagging feels like an afterthought (which is when people actually do it).
 */
export function TagChips({ noteId }: { noteId: string }) {
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [draft, setDraft] = React.useState('');
  const [showInput, setShowInput] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    listNoteTags(noteId)
      .then(setTags)
      .catch(() => undefined);
  }, [noteId]);

  const submit = (override?: string) => {
    const name = (override ?? draft).trim().replace(/^#/, '');
    if (!name) return;
    startTransition(async () => {
      try {
        const t = await attachTag({ noteId, name });
        setTags((arr) => (arr.some((x) => x.id === t.id) ? arr : [...arr, t]));
        setDraft('');
        // Refresh the autocomplete pool so brand-new tags surface next time.
        void loadAllTags();
      } catch (err) {
        toast.error((err as Error).message ?? "Couldn't add tag");
      }
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      await detachTag({ noteId, tagId: id });
      setTags((arr) => arr.filter((t) => t.id !== id));
    });

  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [suggesting, setSuggesting] = React.useState(false);

  // Workspace tag pool for the autocomplete dropdown. Fetched once when
  // the user opens the input and refreshed after a successful attach so
  // brand-new tags appear in subsequent autocompletions.
  const [allTags, setAllTags] = React.useState<Tag[] | null>(null);
  const [hover, setHover] = React.useState(0);
  const loadAllTags = React.useCallback(async () => {
    try {
      const rows = await listTags();
      setAllTags(rows);
    } catch {
      setAllTags([]);
    }
  }, []);
  const attachedNames = React.useMemo(() => new Set(tags.map((t) => t.name)), [tags]);
  const draftQuery = draft.trim().replace(/^#/, '').toLowerCase();
  const matches = React.useMemo(() => {
    if (!allTags || !draftQuery) return [];
    return allTags
      .filter((t) => !attachedNames.has(t.name))
      .filter((t) => t.name.toLowerCase().includes(draftQuery))
      .slice(0, 6);
  }, [allTags, attachedNames, draftQuery]);
  React.useEffect(() => {
    setHover(0);
  }, [draftQuery]);
  const requestSuggestions = async () => {
    setSuggesting(true);
    try {
      const raw = await suggestTagsForNote(noteId);
      // Drop ones already attached.
      const existing = new Set(tags.map((t) => t.name));
      const fresh = raw.filter((t) => !existing.has(t));
      if (fresh.length === 0)
        toast.message('No new tag ideas \u2014 try writing a bit more first.');
      setSuggestions(fresh);
    } catch (err) {
      toast.error((err as Error).message ?? "Couldn't suggest tags");
    } finally {
      setSuggesting(false);
    }
  };

  // Auto-suggest once per note per session: when the note has no tags
  // and the user has had it open for ~30s, quietly fetch up to 3
  // suggestions. Skipped if any suggestion call already happened.
  const autoTriedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoTriedRef.current) return;
    if (tags.length > 0) return;
    const sessionKey = `notai:autotag-tried:${noteId}`;
    try {
      if (window.sessionStorage.getItem(sessionKey)) {
        autoTriedRef.current = true;
        return;
      }
    } catch {
      /* ignore */
    }
    const h = window.setTimeout(async () => {
      autoTriedRef.current = true;
      try {
        window.sessionStorage.setItem(sessionKey, '1');
      } catch {
        /* ignore */
      }
      try {
        const raw = await suggestTagsForNote(noteId);
        const existing = new Set(tags.map((t) => t.name));
        const fresh = raw.filter((t) => !existing.has(t)).slice(0, 3);
        if (fresh.length > 0) setSuggestions(fresh);
      } catch {
        /* silent \u2014 this is best-effort */
      }
    }, 30_000);
    return () => clearTimeout(h);
  }, [noteId, tags]);

  const acceptSuggestion = (name: string) =>
    startTransition(async () => {
      try {
        const t = await attachTag({ noteId, name });
        setTags((arr) => (arr.some((x) => x.id === t.id) ? arr : [...arr, t]));
        setSuggestions((s) => s.filter((x) => x !== name));
      } catch (err) {
        toast.error((err as Error).message ?? "Couldn't add tag");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => {
        const segs = t.name.split('/');
        const leaf = segs[segs.length - 1] ?? t.name;
        const parent = segs.length > 1 ? segs.slice(0, -1).join('/') : null;
        const href = '/app/tags/' + segs.map(encodeURIComponent).join('/');
        return (
          <span
            key={t.id}
            title={t.name}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${colorFor(t.name)}`}
          >
            <Hash className="size-3 opacity-60" />
            <a href={href} className="hover:underline">
              {parent && <span className="opacity-60">{parent}/</span>}
              {leaf}
            </a>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="hover:bg-foreground/10 ml-0.5 rounded-full p-0.5"
              aria-label={`Remove tag ${t.name}`}
              disabled={pending}
            >
              <X className="size-2.5" />
            </button>
          </span>
        );
      })}
      {showInput ? (
        <span className="relative inline-flex">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
              if (allTags == null) void loadAllTags();
            }}
            onBlur={() => {
              // Delay so a click on a suggestion has a chance to fire.
              window.setTimeout(() => {
                if (!draft.trim()) setShowInput(false);
                else submit();
              }, 120);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const picked = matches[hover];
                submit(picked?.name);
              } else if (e.key === 'Escape') {
                setShowInput(false);
                setDraft('');
              } else if (e.key === 'ArrowDown' && matches.length > 0) {
                e.preventDefault();
                setHover((h) => (h + 1) % matches.length);
              } else if (e.key === 'ArrowUp' && matches.length > 0) {
                e.preventDefault();
                setHover((h) => (h - 1 + matches.length) % matches.length);
              }
            }}
            placeholder="tag…"
            className="text-foreground/80 placeholder:text-muted-foreground w-32 bg-transparent text-[11px] outline-none"
          />
          {matches.length > 0 && (
            <ul className="bg-popover absolute left-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-md border text-[11px] shadow-md">
              {matches.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // mousedown beats blur — lets us pick before the input loses focus.
                      e.preventDefault();
                      submit(t.name);
                    }}
                    onMouseEnter={() => setHover(i)}
                    className={`flex w-full items-center gap-1.5 px-2 py-1 text-left ${
                      i === hover ? 'bg-muted' : ''
                    }`}
                  >
                    <Hash className="size-2.5 opacity-60" />
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px]"
        >
          <Plus className="size-3" /> tag
        </button>
      )}
      <button
        type="button"
        onClick={requestSuggestions}
        disabled={suggesting}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] disabled:opacity-50"
        title="Suggest tags with AI"
      >
        <Sparkles className={suggesting ? 'size-3 animate-pulse' : 'size-3'} />
        {suggesting ? 'thinking\u2026' : 'suggest'}
      </button>
      {suggestions.map((name) => (
        <button
          key={`sugg-${name}`}
          type="button"
          onClick={() => acceptSuggestion(name)}
          disabled={pending}
          className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium opacity-80 hover:opacity-100 ${colorFor(name)}`}
          title="Click to accept this AI-suggested tag"
        >
          <Plus className="size-2.5" />
          {name}
        </button>
      ))}
    </div>
  );
}
