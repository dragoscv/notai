import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const SUPPORTED_LOCALES = ['en', 'ro'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'notai_locale';

function pickFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(',')) {
    const tag = part.trim().split(';')[0]?.toLowerCase().split('-')[0];
    if (tag && (SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
      return tag as Locale;
    }
  }
  return DEFAULT_LOCALE;
}

/** Resolve the active locale from cookie → Accept-Language → default. Server-side. */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie && (SUPPORTED_LOCALES as readonly string[]).includes(fromCookie)) {
    return fromCookie as Locale;
  }
  const h = await headers();
  return pickFromAcceptLanguage(h.get('accept-language'));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`./messages/${locale}.json`)).default as Record<string, string>;
  return { locale, messages };
});
