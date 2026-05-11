'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from '@/../i18n';

export async function setLocale(locale: Locale) {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { ok: false as const, error: 'unsupported_locale' };
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
