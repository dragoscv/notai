import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, Pin, Star } from 'lucide-react';
import { LocalDateTime } from '@/components/ui/local-datetime';
import { NoteIcon } from '@/components/ui/note-icon';
import type { listNotes } from '@/server/actions/notes';

export type NoteWithPreview = Awaited<ReturnType<typeof listNotes>>[number];

/**
 * Note card used on /app (Today) and /app/f/[id] (folder pages).
 *
 * Visual language matches the rest of the app: a subtle sticky-note
 * coloured "tape" along the top, ruled-paper preview body, and a
 * minimal footer with the most recent edit time.
 *
 * Card colour is deterministic per note id so a wall of cards looks
 * varied but stable across renders. Pinned notes get a fixed yellow
 * tape regardless of their hash so they're visually grouped.
 */

/* Static class strings — Tailwind's JIT only generates utilities it can see
 * literally in source, so we keep the full class names here rather than
 * building them dynamically. */
const TAPE_CLASSES = [
  'bg-sticky-yellow',
  'bg-sticky-pink',
  'bg-sticky-blue',
  'bg-sticky-green',
  'bg-sticky-purple',
  'bg-sticky-orange',
] as const;

function pickTapeClass(id: string, isPinned: boolean): string {
  if (isPinned) return 'bg-sticky-yellow';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAPE_CLASSES[h % TAPE_CLASSES.length]!;
}

export function NoteCard({ note }: { note: NoteWithPreview }) {
  const t = useTranslations('editor.card');
  const html = note.previewHtml?.trim() ?? '';
  const hasContent = html.length > 0;
  const tapeClass = pickTapeClass(note.id, note.isPinned);

  return (
    <Link href={`/app/n/${note.id}`} className="group block">
      <div className="bg-card text-card-foreground group-hover:shadow-foreground/10 relative flex aspect-[9/16] flex-col overflow-hidden rounded-xl border shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-xl">
        {/* Sticky-coloured top tape */}
        <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${tapeClass}`} />

        {/* Header */}
        <div className="bg-card/80 flex items-center gap-1.5 border-b px-3 pb-2 pt-2.5 backdrop-blur">
          <NoteIcon icon={note.icon} className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-serif text-[13px] font-semibold tracking-tight">
            {note.title || t('untitled')}
          </span>
          <div className="text-muted-foreground flex shrink-0 items-center gap-0.5">
            {note.isPinned && (
              <span title={t('pinned')} className="grid size-4 place-items-center">
                <Pin className="size-3" />
              </span>
            )}
            {note.isFavorite && (
              <span
                title={t('favorite')}
                className="grid size-4 place-items-center text-yellow-500"
              >
                <Star className="size-3 fill-current" />
              </span>
            )}
          </div>
        </div>

        {/* Body — ruled paper preview */}
        <div
          data-surface="ruled"
          className="bg-background relative flex-1 overflow-hidden"
          style={{ ['--paper-spacing' as string]: '22px' }}
        >
          {hasContent ? (
            <div
              className="note-preview text-foreground/90 pointer-events-none select-none px-3 py-1.5 text-[15px] leading-[22px]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-muted-foreground/60 px-3 py-1.5 text-[15px] italic leading-[22px]">
              {t('startWriting')}
            </p>
          )}
          <div className="from-card via-card/80 pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent" />
        </div>

        {/* Footer */}
        <div className="bg-card/80 text-muted-foreground flex items-center gap-1 border-t px-3 py-1.5 text-[10px] backdrop-blur">
          <Clock className="size-3 shrink-0" />
          <LocalDateTime date={note.updatedAt} className="truncate" />
        </div>
      </div>
    </Link>
  );
}
