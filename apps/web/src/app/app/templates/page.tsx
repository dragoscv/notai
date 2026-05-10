import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { listTemplates, applyTemplate } from '@/server/actions/templates';

export const metadata = { title: 'Templates — Notai' };

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/templates');
  const tpls = await listTemplates();

  // Group by category for the rail layout.
  const byCategory = new Map<string, typeof tpls>();
  for (const t of tpls) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Start a note from a template. Designed for ADHD brains: tiny, forgiving structure that you
          can rewrite freely.
        </p>
      </header>

      {tpls.length === 0 && (
        <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
          No templates yet. Run <code>pnpm --filter @notai/db seed:templates</code>
          to populate the gallery.
        </p>
      )}

      {[...byCategory.entries()].map(([cat, items]) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
            {cat}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <li key={t.id}>
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
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-muted-foreground pt-4 text-xs">
        <Link href="/app" className="underline">
          Back to your notes
        </Link>
      </p>
    </div>
  );
}
