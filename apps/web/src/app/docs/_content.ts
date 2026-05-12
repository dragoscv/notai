import type { DocArticle } from './_content.en';
import { DOCS as DOCS_EN } from './_content.en';

export type { DocArticle };
export type DocsLocale = 'en' | 'ro';

/** Locale-agnostic slug list used for static params + sitemaps. */
export const DOC_SLUGS = DOCS_EN.map((d) => d.slug);

export async function getLocalizedDocs(locale: DocsLocale): Promise<DocArticle[]> {
  if (locale === 'ro') {
    const mod = await import('./_content.ro');
    return mod.DOCS;
  }
  return DOCS_EN;
}

export async function getLocalizedDoc(
  slug: string,
  locale: DocsLocale,
): Promise<DocArticle | undefined> {
  const docs = await getLocalizedDocs(locale);
  return docs.find((d) => d.slug === slug);
}

export const DOC_GROUP_KEYS = [
  'Getting started',
  'Features',
  'Account & billing',
  'Developers',
] as const;
export type DocGroupKey = (typeof DOC_GROUP_KEYS)[number];

export const DOC_GROUP_LABELS: Record<DocsLocale, Record<DocGroupKey, string>> = {
  en: {
    'Getting started': 'Getting started',
    Features: 'Features',
    'Account & billing': 'Account & billing',
    Developers: 'Developers',
  },
  ro: {
    'Getting started': 'Primii pași',
    Features: 'Funcționalități',
    'Account & billing': 'Cont și facturare',
    Developers: 'Dezvoltatori',
  },
};

export const DOCS_INDEX_STRINGS: Record<
  DocsLocale,
  { title: string; subtitle: string; minRead: (n: number) => string }
> = {
  en: {
    title: 'Documentation',
    subtitle:
      'Short guides for Notai. If something is missing, write to hello@notai.ro and we will add it.',
    minRead: (n) => `${n} min read`,
  },
  ro: {
    title: 'Documentație',
    subtitle:
      'Ghiduri scurte pentru Notai. Dacă lipsește ceva, scrie la hello@notai.ro și adăugăm.',
    minRead: (n) => `${n} min lectură`,
  },
};

// Sync EN re-exports for static contexts that cannot await (sitemap, OG images).
export { DOCS_EN };
export const DOCS_BY_SLUG_EN = new Map(DOCS_EN.map((d) => [d.slug, d]));
export const DOCS = DOCS_EN;
export const DOCS_BY_SLUG = DOCS_BY_SLUG_EN;
