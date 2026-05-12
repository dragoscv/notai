'use client';
import * as React from 'react';
import Link from 'next/link';
import { Square, FileText, ListTodo } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getOpenLoops, type OpenLoop } from '@/server/actions/open-loops';

/**
 * Dashboard "Open loops" card. Aggregates every unchecked `[ ] \u2026`
 * TODO across the user's recently touched notes so all the loose
 * threads sit in one place. Quietly hidden when nothing is open.
 */
export function OpenLoopsCard() {
  const t = useTranslations('dashboard.openLoops');
  const [items, setItems] = React.useState<OpenLoop[] | null>(null);
  React.useEffect(() => {
    void getOpenLoops()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <ListTodo className="size-3.5" />
        <span>{t('label')}</span>
        <span className="ml-auto">{items.length}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={`${it.noteId}-${i}`} className="flex items-start gap-2 text-sm">
            <Square className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 leading-snug">{it.text}</span>
            <Link
              href={`/app/n/${it.noteId}`}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[11px]"
              title={it.noteTitle ?? t('untitled')}
            >
              <span className="size-3 text-center">
                {it.noteIcon || <FileText className="size-3 opacity-60" />}
              </span>
              <span className="max-w-[10rem] truncate">{it.noteTitle || t('untitled')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
