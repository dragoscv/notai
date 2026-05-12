/**
 * Renders a `<script type="application/ld+json">` tag with the given
 * structured data payload. Shape your data as a plain object matching
 * a schema.org type (Organization, SoftwareApplication, FAQPage,
 * Article, BreadcrumbList, etc.) — we serialize and inline it.
 *
 * The JSON is escaped so a `</script>` substring in any string field
 * cannot break out of the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';

/** Organization schema, safe to render in the root layout. */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Notai',
  url: BASE_URL,
  logo: `${BASE_URL}/icons/icon.svg`,
  sameAs: ['https://github.com/dragoscv/notai'],
  founder: {
    '@type': 'Person',
    name: 'Vlăduțescu Dragoș Cătălin',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${BASE_URL}/support/new`,
      availableLanguage: ['en', 'ro'],
    },
  ],
} as const;

/** SoftwareApplication schema for the homepage. */
export const SOFTWARE_APPLICATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Notai',
  url: BASE_URL,
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web, Windows, macOS, Linux, Android, iOS',
  description:
    'A calm, local-first notes app with sticky windows, drawings, and optional cloud sync.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'EUR',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '5',
      priceCurrency: 'EUR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '5',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
  ],
  publisher: ORGANIZATION_SCHEMA,
} as const;

interface BreadcrumbItem {
  name: string;
  url: string;
}

/** Build a BreadcrumbList for a page given a list of {name, url} crumbs. */
export function breadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

interface FaqEntry {
  question: string;
  answer: string;
}

/** Build a FAQPage schema from a flat list of Q/A pairs. */
export function faqSchema(items: FaqEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.answer,
      },
    })),
  };
}

interface ArticleSchemaInput {
  title: string;
  description: string;
  slug: string;
  updated: string;
}

/** Build a TechArticle schema for a docs page. */
export function articleSchema({
  title,
  description,
  slug,
  updated,
}: ArticleSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: `${BASE_URL}/docs/${slug}`,
    dateModified: updated,
    author: { '@type': 'Organization', name: 'Notai' },
    publisher: ORGANIZATION_SCHEMA,
  };
}
