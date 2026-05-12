'use client';

import * as React from 'react';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  applyTemplate,
  deletePersonalTemplate,
  type TemplateSummary,
} from '@/server/actions/templates';

interface Props {
  templates: TemplateSummary[];
}

export function TemplatesGalleryClient({ templates }: Props) {
  const t = useTranslations('pages.templates');
  const [q, setQ] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [localTemplates, setLocalTemplates] = React.useState(templates);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? localTemplates.filter(
        (tpl) =>
          tpl.title.toLowerCase().includes(needle) ||
          tpl.description.toLowerCase().includes(needle) ||
          tpl.category.toLowerCase().includes(needle),
      )
    : localTemplates;

  const byCategory = new Map<string, TemplateSummary[]>();
  for (const tpl of filtered) {
    const arr = byCategory.get(tpl.category) ?? [];
    arr.push(tpl);
    byCategory.set(tpl.category, arr);
  }

  const onDelete = (slug: string, title: string) => {
    if (!confirm(t('deleteConfirm', { title }))) return;
    startTransition(async () => {
      try {
        await deletePersonalTemplate({ slug });
        setLocalTemplates((arr) => arr.filter((tpl) => tpl.slug !== slug));
        toast.success(t('deleted'));
      } catch (err) {
        toast.error((err as Error).message ?? t('deleteFailed'));
      }
    });
  };

  return (
    <div className="space-y-10">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="border-input bg-background w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
          {needle ? t('noMatch', { query: q }) : t('noTemplates')}
        </p>
      )}

      {[...byCategory.entries()].map(([cat, items]) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
            {cat}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((tpl) => (
              <li key={tpl.id} className="relative">
                <form action={applyTemplate}>
                  <input type="hidden" name="slug" value={tpl.slug} />
                  <button
                    type="submit"
                    className="bg-card group block w-full rounded-2xl border p-4 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="bg-muted/70 grid size-10 shrink-0 place-items-center rounded-lg text-xl">
                        {tpl.icon ?? '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {tpl.title}
                          {tpl.isPersonal && (
                            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                              {t('personalBadge')}
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {tpl.description}
                        </p>
                      </div>
                    </div>
                  </button>
                </form>
                {tpl.isPersonal && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDelete(tpl.slug, tpl.title)}
                    className="text-muted-foreground hover:text-destructive absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition focus:opacity-100 group-hover:opacity-100"
                    aria-label={t('deletePersonalLabel')}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
