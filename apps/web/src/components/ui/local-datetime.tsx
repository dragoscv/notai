'use client';
import { useEffect, useMemo, useState } from 'react';

/**
 * Renders a Date using the user's OS locale + timezone, with seconds.
 *
 * Server rendering would use the server's locale/tz which mismatches the
 * user, so we render an ISO placeholder during SSR and swap to the
 * localized string after mount. `suppressHydrationWarning` keeps React
 * quiet about the intentional mismatch.
 */
export function LocalDateTime({ date, className }: { date: Date | string; className?: string }) {
    const d = useMemo(() => (typeof date === 'string' ? new Date(date) : date), [date]);
    const iso = d.toISOString();
    const [text, setText] = useState(iso);

    useEffect(() => {
        setText(
            d.toLocaleString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }),
        );
    }, [d]);

    return (
        <time dateTime={iso} className={className} suppressHydrationWarning>
            {text}
        </time>
    );
}
