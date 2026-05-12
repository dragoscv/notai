'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setLocale } from '@/server/actions/locale';

/**
 * Compact EN/RO toggle for the marketing header. Sets the locale cookie
 * via the existing setLocale server action and triggers a layout
 * revalidate so the new language is reflected on the next paint.
 */
export function MarketingLocaleToggle() {
  const current = useLocale();
  const [pending, start] = useTransition();
  function pick(next: 'en' | 'ro') {
    if (next === current || pending) return;
    start(() => setLocale(next).then(() => undefined));
  }
  const baseBtn = 'px-2 py-1 text-xs font-medium uppercase tracking-wider transition rounded-md';
  return (
    <div
      role="group"
      aria-label="Language"
      className="border-border/60 bg-background/40 inline-flex items-center rounded-md border p-0.5"
    >
      <button
        type="button"
        onClick={() => pick('en')}
        aria-pressed={current === 'en'}
        className={`${baseBtn} ${current === 'en' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => pick('ro')}
        aria-pressed={current === 'ro'}
        className={`${baseBtn} ${current === 'ro' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
      >
        RO
      </button>
    </div>
  );
}
