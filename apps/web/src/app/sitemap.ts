import type { MetadataRoute } from 'next';
import { DOCS } from './docs/_content';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';

/** Marketing + legal + docs URLs that should be crawled. */
const STATIC_PATHS: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/roadmap', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/support/new', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/signin', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/status', changeFrequency: 'daily', priority: 0.4 },
  // Legal
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/aup', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/accessibility', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const docEntries: MetadataRoute.Sitemap = DOCS.map((d) => ({
    url: `${BASE_URL}/docs/${d.slug}`,
    lastModified: new Date(d.updated),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...docEntries];
}
