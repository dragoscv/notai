import Link from 'next/link';
import { Clock, CalendarPlus } from 'lucide-react';
import { Card } from '@notai/ui/components/card';
import { LocalDateTime } from '@/components/ui/local-datetime';
import { NoteIcon } from '@/components/ui/note-icon';
import type { listNotes } from '@/server/actions/notes';

export type NoteWithPreview = Awaited<ReturnType<typeof listNotes>>[number];

/**
 * The card used on /app (Today) and /app/f/[id] (folder pages). Renders
 * a vertical preview of the note body using the ruled-paper surface so the
 * card looks like a miniature of the actual note.
 */
export function NoteCard({ note }: { note: NoteWithPreview }) {
    const html = note.previewHtml?.trim() ?? '';
    const hasContent = html.length > 0;

    return (
        <Link href={`/app/n/${note.id}`} className="group block">
            <Card className="flex aspect-[9/16] flex-col overflow-hidden p-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-2">
                    <NoteIcon icon={note.icon} className="size-4 shrink-0" />
                    <span className="truncate text-xs font-semibold">{note.title}</span>
                </div>

                <div
                    data-surface="ruled"
                    className="relative flex-1 overflow-hidden bg-background"
                    style={{ ['--paper-spacing' as string]: '22px' }}
                >
                    {hasContent ? (
                        <div
                            className="note-preview pointer-events-none select-none px-3 py-1.5 text-[15px] leading-[22px] text-foreground/90"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    ) : (
                        <p className="px-3 py-1.5 text-[15px] italic leading-[22px] text-muted-foreground/60">
                            Start writing…
                        </p>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
                </div>

                <div className="space-y-0.5 border-t bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1" title="Last modified">
                        <Clock className="size-3 shrink-0" />
                        <LocalDateTime date={note.updatedAt} className="truncate" />
                    </div>
                    <div className="flex items-center gap-1" title="Created">
                        <CalendarPlus className="size-3 shrink-0" />
                        <LocalDateTime date={note.createdAt} className="truncate" />
                    </div>
                </div>
            </Card>
        </Link>
    );
}
