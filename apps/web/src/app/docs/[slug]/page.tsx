import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DOCS, DOCS_BY_SLUG } from '../_content';
import { DocsShell } from '../_shell';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS_BY_SLUG.get(slug);
  if (!doc) return { title: 'Not found' };
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: `/docs/${doc.slug}` },
  };
}

export default async function DocsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const doc = DOCS_BY_SLUG.get(slug);
  if (!doc) notFound();

  const idx = DOCS.findIndex((d) => d.slug === doc.slug);
  const next = DOCS[idx + 1];

  return (
    <DocsShell
      title={doc.title}
      subtitle={doc.summary}
      updated={doc.updated}
      readingMinutes={doc.readingMinutes}
    >
      {doc.body}

      {next ? (
        <div className="not-prose mt-16">
          <Link
            href={`/docs/${next.slug}`}
            className="border-border/60 hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring group flex items-center justify-between rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Next</p>
              <p className="mt-1 font-medium">{next.title}</p>
            </div>
            <ArrowRight
              className="text-muted-foreground group-hover:text-primary size-5 transition-colors"
              aria-hidden
            />
          </Link>
        </div>
      ) : null}
    </DocsShell>
  );
}
