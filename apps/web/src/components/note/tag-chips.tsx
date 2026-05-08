'use client';
import * as React from 'react';
import { Hash, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { attachTag, detachTag, listNoteTags } from '@/server/actions/tags';

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

  const submit = () => {
    const name = draft.trim().replace(/^#/, '');
    if (!name) return;
    startTransition(async () => {
      try {
        const t = await attachTag({ noteId, name });
        setTags((arr) => (arr.some((x) => x.id === t.id) ? arr : [...arr, t]));
        setDraft('');
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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${colorFor(t.name)}`}
        >
          <Hash className="size-3 opacity-60" />
          {t.name}
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
      ))}
      {showInput ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!draft.trim()) setShowInput(false);
            else submit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              setShowInput(false);
              setDraft('');
            }
          }}
          placeholder="tag…"
          className="text-foreground/80 placeholder:text-muted-foreground w-24 bg-transparent text-[11px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px]"
        >
          <Plus className="size-3" /> tag
        </button>
      )}
    </div>
  );
}
