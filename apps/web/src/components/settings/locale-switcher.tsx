'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { setLocale } from '@/server/actions/locale';

export function LocaleSwitcher() {
  const current = useLocale();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Globe className="size-4" aria-hidden />
      <select
        defaultValue={current}
        disabled={pending}
        onChange={(e) =>
          start(() => setLocale(e.target.value as 'en' | 'ro').then(() => undefined))
        }
        className="bg-background rounded-md border px-2 py-1 text-sm"
        aria-label="Language"
      >
        <option value="en">English</option>
        <option value="ro">Română</option>
      </select>
    </label>
  );
}
