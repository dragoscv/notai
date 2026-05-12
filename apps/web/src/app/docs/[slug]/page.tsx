import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { resolveLocale } from '../../../../i18n';
import { DOC_SLUGS, DOCS_BY_SLUG_EN, getLocalizedDoc, getLocalizedDocs } from '../_content';
import { DocsShell } from '../_shell';
import { JsonLd, articleSchema, breadcrumbSchema } from '@/components/seo/json-ld';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await resolveLocale();
  const doc = (await getLocalizedDoc(slug, locale)) ?? DOCS_BY_SLUG_EN.get(slug);
  if (!doc) return { title: 'Not found' };
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: `/docs/${doc.slug}` },
  };
}

export default async function DocsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await resolveLocale();
  const doc = (await getLocalizedDoc(slug, locale)) ?? DOCS_BY_SLUG_EN.get(slug);
  if (!doc) notFound();

  const docs = await getLocalizedDocs(locale);
  const idx = docs.findIndex((d) => d.slug === doc.slug);
  const next = docs[idx + 1];
  const nextLabel = locale === 'ro' ? 'Următor' : 'Next';

  return (
    <DocsShell
      title={doc.title}
      subtitle={doc.summary}
      updated={doc.updated}
      readingMinutes={doc.readingMinutes}
    >
      <JsonLd
        data={[
          articleSchema({
            title: doc.title,
            description: doc.summary,
            slug: doc.slug,
            updated: doc.updated,
          }),
          breadcrumbSchema([
            { name: 'Docs', url: '/docs' },
            { name: doc.title, url: `/docs/${doc.slug}` },
          ]),
        ]}
      />
      {doc.body}

      {next ? (
        <div className="not-prose mt-16">
          <Link
            href={`/docs/${next.slug}`}
            className="border-border/60 hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring group flex items-center justify-between rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">{nextLabel}</p>
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
