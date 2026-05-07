import Link from 'next/link';
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
    const html = note.previewHtml?.trim() ?? '';
    const hasContent = html.length > 0;
    const tapeClass = pickTapeClass(note.id, note.isPinned);

    return (
        <Link href={`/app/n/${note.id}`} className="group block">
            <div className="relative flex aspect-[9/16] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-foreground/10">
                {/* Sticky-coloured top tape */}
                <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${tapeClass}`} />

                {/* Header */}
                <div className="flex items-center gap-1.5 border-b bg-card/80 px-3 pt-2.5 pb-2 backdrop-blur">
                    <NoteIcon icon={note.icon} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-serif text-[13px] font-semibold tracking-tight">
                        {note.title || 'Untitled'}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                        {note.isPinned && (
                            <span title="Pinned" className="grid size-4 place-items-center">
                                <Pin className="size-3" />
                            </span>
                        )}
                        {note.isFavorite && (
                            <span title="Favorite" className="grid size-4 place-items-center text-yellow-500">
                                <Star className="size-3 fill-current" />
                            </span>
                        )}
                    </div>
                </div>

                {/* Body — ruled paper preview */}
                <div
                    data-surface="ruled"
                    className="relative flex-1 overflow-hidden bg-background"
                    style={{ ['--paper-spacing' as string]: '22px' }}
                >
                    {hasContent ? (
                        <div
                            className="note-preview pointer-events-none px-3 py-1.5 text-[15px] leading-[22px] text-foreground/90 select-none"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    ) : (
                        <p className="px-3 py-1.5 text-[15px] leading-[22px] text-muted-foreground/60 italic">
                            Start writing…
                        </p>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/80 to-transparent" />
                </div>

                {/* Footer */}
                <div className="flex items-center gap-1 border-t bg-card/80 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
                    <Clock className="size-3 shrink-0" />
                    <LocalDateTime date={note.updatedAt} className="truncate" />
                </div>
            </div>
        </Link>
    );
}
