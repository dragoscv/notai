'use client';
import * as React from 'react';
import { StickyNote, ExternalLink, X } from 'lucide-react';
import { useOpenStickies, forgetOpenSticky, type OpenSticky } from '@notai/editor';
import { Button } from '@notai/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import { Badge } from '@notai/ui/components/badge';
import { cn } from '@notai/lib/utils';
import { isTauri, invoke } from '@/lib/tauri';

/**
 * Shared button+popover listing the currently-open sticky windows.
 * Used in the note header (icon-sm) and the sidebar footer (full width).
 */
export function OpenStickiesButton({
    variant = 'icon',
    className,
}: {
    variant?: 'icon' | 'inline';
    className?: string;
}) {
    const stickies = useOpenStickies();
    const count = stickies.length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                {variant === 'icon' ? (
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        className={cn('relative', className)}
                        aria-label={`${count} sticky window${count === 1 ? '' : 's'} open`}
                        title={count ? `${count} sticky open` : 'No stickies open'}
                    >
                        <StickyNote />
                        {count > 0 && (
                            <Badge
                                variant="secondary"
                                className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
                            >
                                {count}
                            </Badge>
                        )}
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        className={cn('w-full justify-start gap-2', className)}
                    >
                        <StickyNote className="size-4" />
                        <span className="flex-1 text-left">Open stickies</span>
                        {count > 0 && (
                            <Badge variant="secondary" className="ml-auto">
                                {count}
                            </Badge>
                        )}
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1">
                {count === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                        No sticky windows open.
                        <br />
                        Click the panel icon on any note to pop one out.
                    </div>
                ) : (
                    <ul className="max-h-72 overflow-y-auto">
                        {stickies.map((s) => (
                            <StickyRow key={s.id} sticky={s} />
                        ))}
                    </ul>
                )}
            </PopoverContent>
        </Popover>
    );
}

function StickyRow({ sticky }: { sticky: OpenSticky }) {
    const focus = async () => {
        if (isTauri()) {
            try {
                await invoke('open_sticky', { noteId: sticky.id });
                return;
            } catch {
                /* fall through */
            }
        }
        // In a regular browser we can't focus an existing window we didn't open
        // from this tab. Best we can do is reopen by the same name, which
        // focuses it if still alive.
        window.open(`/sticky/${sticky.id}`, `sticky-${sticky.id}`);
    };

    return (
        <li className="flex items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent">
            <button
                type="button"
                onClick={focus}
                className="flex flex-1 items-center gap-2 truncate rounded px-2 py-1.5 text-left"
                title="Focus sticky window"
            >
                <StickyNote className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{sticky.title}</span>
                <ExternalLink className="ml-auto size-3 opacity-0 group-hover:opacity-60" />
            </button>
            <Button
                size="icon-sm"
                variant="ghost"
                className="size-7"
                onClick={() => forgetOpenSticky(sticky.id)}
                aria-label="Remove from list"
                title="Remove from list (doesn't close the window)"
            >
                <X className="size-3" />
            </Button>
        </li>
    );
}
