import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Don't index the signed-in app, internal APIs, or admin pages.
        // OAuth + checkout flows should also stay out of the index.
        disallow: [
          '/app/',
          '/api/',
          '/admin/',
          '/u/*/edit',
          '/share/',
          '/sticky/',
          '/clip/',
          '/unsubscribe',
          '/settings/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
