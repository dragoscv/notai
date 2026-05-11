'use client';

import * as React from 'react';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  applyTemplate,
  deletePersonalTemplate,
  type TemplateSummary,
} from '@/server/actions/templates';

interface Props {
  templates: TemplateSummary[];
}

export function TemplatesGalleryClient({ templates }: Props) {
  const [q, setQ] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [localTemplates, setLocalTemplates] = React.useState(templates);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? localTemplates.filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          t.description.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle),
      )
    : localTemplates;

  const byCategory = new Map<string, TemplateSummary[]>();
  for (const t of filtered) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  const onDelete = (slug: string, title: string) => {
    if (!confirm(`Delete personal template "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deletePersonalTemplate({ slug });
        setLocalTemplates((arr) => arr.filter((t) => t.slug !== slug));
        toast.success('Template deleted');
      } catch (err) {
        toast.error((err as Error).message ?? 'Failed to delete');
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
          placeholder="Search templates…"
          className="border-input bg-background w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
          {needle ? `No templates match "${q}".` : 'No templates yet.'}
        </p>
      )}

      {[...byCategory.entries()].map(([cat, items]) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
            {cat}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <li key={t.id} className="relative">
                <form action={applyTemplate}>
                  <input type="hidden" name="slug" value={t.slug} />
                  <button
                    type="submit"
                    className="bg-card group block w-full rounded-2xl border p-4 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="bg-muted/70 grid size-10 shrink-0 place-items-center rounded-lg text-xl">
                        {t.icon ?? '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {t.title}
                          {t.isPersonal && (
                            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                              Personal
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {t.description}
                        </p>
                      </div>
                    </div>
                  </button>
                </form>
                {t.isPersonal && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDelete(t.slug, t.title)}
                    className="text-muted-foreground hover:text-destructive absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition focus:opacity-100 group-hover:opacity-100"
                    aria-label="Delete personal template"
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
