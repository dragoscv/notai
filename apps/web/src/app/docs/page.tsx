import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DOCS } from './_content';
import { DocsShell } from './_shell';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Notai documentation — getting started, keyboard shortcuts, AI features, sync, billing, and the public API.',
  alternates: { canonical: '/docs' },
};

const GROUPS = ['Getting started', 'Features', 'Account & billing', 'Developers'] as const;

export default function DocsIndexPage() {
  return (
    <DocsShell
      title="Documentation"
      subtitle="Short guides for Notai. If something is missing, write to hello@notai.ro and we will add it."
    >
      <div className="not-prose space-y-10">
        {GROUPS.map((group) => {
          const items = DOCS.filter((d) => d.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="text-xl font-semibold tracking-tight">{group}</h2>
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
                        {doc.readingMinutes} min read
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
