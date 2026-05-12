'use client';
import * as React from 'react';
import Link from 'next/link';
import { ListTodo, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getStaleTodos, type StaleTodo } from '@/server/actions/stale-todos';

/**
 * Stale TODO digest. Lists up to 6 unchecked `[ ]` items from notes
 * that haven't been touched in 14+ days. Renders nothing when there
 * are none — silence is a good outcome.
 */
export function StaleTodosCard() {
  const t = useTranslations('dashboard.staleTodos');
  const [items, setItems] = React.useState<StaleTodo[] | null>(null);

  React.useEffect(() => {
    void getStaleTodos()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items === null || items.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <ListTodo className="size-3.5" />
        <span>{t('label')}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={`${it.noteId}-${i}`}>
            <Link
              href={`/app/n/${it.noteId}`}
              className="hover:bg-muted/60 group flex items-start gap-2 rounded-lg p-1.5 transition-colors"
            >
              <span className="border-muted-foreground/40 mt-0.5 inline-block size-3.5 shrink-0 rounded-sm border" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="line-clamp-1">{it.text}</span>
                <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
                  <span aria-hidden>{it.noteIcon ?? '📝'}</span>
                  <span className="truncate">{it.noteTitle || t('untitled')}</span>
                  <span>&middot;</span>
                  <span>{formatDays(it.daysAgo)}</span>
                </span>
              </span>
              <ArrowRight className="text-muted-foreground/0 group-hover:text-muted-foreground/70 mt-1 size-3.5 shrink-0 transition-colors" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDays(d: number): string {
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}
