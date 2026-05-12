import { notFound } from 'next/navigation';
import { DOCS_BY_SLUG, DOCS } from '../_content';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const runtime = 'edge';
export const alt = 'Notai docs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS_BY_SLUG.get(slug);
  if (!doc) notFound();
  return ogCard({
    eyebrow: 'Docs',
    title: doc.title,
    subtitle: doc.summary,
  });
}
