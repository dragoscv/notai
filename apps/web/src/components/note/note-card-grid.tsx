'use client';

import { NoteCard, type NoteWithPreview } from './note-card';
import { useNoteActions } from './use-note-actions';
import { cn } from '@notai/lib/utils';

/**
 * Renders a responsive grid of NoteCards with right-click context menus
 * wired in. Use on the Today page, folder pages, etc. Dialogs (confirm,
 * prompt, icon picker) are mounted once for the entire grid so we don't
 * spawn N copies.
 */
export function NoteCardGrid({
    notes,
    className,
}: {
    notes: NoteWithPreview[];
    className?: string;
}) {
    const actions = useNoteActions();
    return (
        <>
            <div
                className={cn(
                    'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
                    className,
                )}
            >
                {notes.map((n) => (
                    <actions.ContextMenu key={n.id} note={n}>
                        <div>
                            <NoteCard note={n} />
                        </div>
                    </actions.ContextMenu>
                ))}
            </div>
            {actions.dialogs}
        </>
    );
}
