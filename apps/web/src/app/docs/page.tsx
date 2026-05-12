import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { resolveLocale } from '../../../i18n';
import { DOC_GROUP_KEYS, DOC_GROUP_LABELS, DOCS_INDEX_STRINGS, getLocalizedDocs } from './_content';
import { DocsShell } from './_shell';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Documentație' : 'Documentation',
    description: isRo
      ? 'Documentație Notai — primii pași, scurtături, funcționalități AI, sincronizare, facturare și API public.'
      : 'Notai documentation — getting started, keyboard shortcuts, AI features, sync, billing, and the public API.',
    alternates: { canonical: '/docs' },
  };
}

export default async function DocsIndexPage() {
  const locale = await resolveLocale();
  const docs = await getLocalizedDocs(locale);
  const strings = DOCS_INDEX_STRINGS[locale];
  const labels = DOC_GROUP_LABELS[locale];

  return (
    <DocsShell title={strings.title} subtitle={strings.subtitle}>
      <div className="not-prose space-y-10">
        {DOC_GROUP_KEYS.map((group) => {
          const items = docs.filter((d) => d.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="text-xl font-semibold tracking-tight">{labels[group]}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {items.map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={`/docs/${doc.slug}`}
                      className="border-border/60 hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring group block rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{doc.title}</span>
                        <ArrowRight
                          className="text-muted-foreground group-hover:text-primary size-4 transition-colors"
                          aria-hidden
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">{doc.summary}</p>
                      <p className="text-muted-foreground/70 mt-2 text-xs">
                        {strings.minRead(doc.readingMinutes)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </DocsShell>
  );
}
