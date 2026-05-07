'use client';
import * as React from 'react';
import { Icon } from '@iconify/react';
import { FileText } from 'lucide-react';
import { cn } from '@notai/lib/utils';

/**
 * Renders a note/folder icon. Supported formats:
 *  - `null` / `undefined` → falls back to the default `FileText` lucide glyph
 *  - A single emoji / short string (no ':') → rendered as text
 *  - An Iconify identifier `"prefix:name"` (e.g. `lucide:book`, `tabler:brand-github`)
 *
 * `@iconify/react` lazily fetches icon data from the Iconify API and caches
 * it, so the initial paint may flash. When the identifier is wrong we
 * render the default glyph so the UI never breaks.
 */
export function NoteIcon({
    icon,
    className,
    fallback,
}: {
    icon?: string | null;
    className?: string;
    /** Render this when no icon is set. Defaults to the `FileText` lucide glyph. */
    fallback?: React.ReactNode;
}) {
    if (!icon) {
        return fallback !== undefined ? (
            <>{fallback}</>
        ) : (
            <FileText className={cn('size-4', className)} />
        );
    }
    if (icon.includes(':')) {
        return <Icon icon={icon} className={className} />;
    }
    // Plain emoji / text.
    return <span className={className}>{icon}</span>;
}
