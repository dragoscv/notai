'use client';

import * as React from 'react';
import { Button } from '@notai/ui/components/button';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  addCalendarSubscription,
  removeCalendarSubscription,
  toggleCalendarSubscription,
  type CalendarSubscription,
} from '@/server/actions/calendar-subs';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function CalendarsManager({ initial }: { initial: CalendarSubscription[] }) {
  const t = useTranslations('settings.calendars');
  const [subs, setSubs] = React.useState(initial);
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [color, setColor] = React.useState(PALETTE[0]!);
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!name.trim() || !url.trim()) {
      toast.error(t('nameUrlRequired'));
      return;
    }
    setBusy(true);
    try {
      await addCalendarSubscription({ name: name.trim(), url: url.trim(), color });
      // Re-fetch via location refresh would lose form state; do a soft re-render by appending.
      setSubs((s) => [
        ...s,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          url: url.trim().replace(/^webcal:\/\//i, 'https://'),
          color,
          enabled: true,
        },
      ]);
      setName('');
      setUrl('');
      toast.success(t('added'));
    } catch (err) {
      toast.error((err as Error).message || t('failedAdd'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = subs;
    setSubs((s) => s.filter((x) => x.id !== id));
    try {
      await removeCalendarSubscription(id);
    } catch (err) {
      setSubs(prev);
      toast.error((err as Error).message || t('failedRemove'));
    }
  }

  async function toggle(id: string, next: boolean) {
    setSubs((s) => s.map((x) => (x.id === id ? { ...x, enabled: next } : x)));
    try {
      await toggleCalendarSubscription(id, next);
    } catch (err) {
      toast.error((err as Error).message || t('failedUpdate'));
    }
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {subs.length === 0 && (
          <li className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            {t('empty')}
          </li>
        )}
        {subs.map((sub) => (
          <li key={sub.id} className="bg-card flex items-center gap-3 rounded-xl border px-3 py-2">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: sub.color ?? '#6366f1' }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{sub.name}</div>
              <div className="text-muted-foreground truncate font-mono text-xs">{sub.url}</div>
            </div>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={sub.enabled}
                onChange={(e) => void toggle(sub.id, e.target.checked)}
              />
              {t('onLabel')}
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void remove(sub.id)}
              aria-label={t('removeAria')}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="bg-card space-y-3 rounded-xl border p-4">
        <h3 className="text-sm font-semibold">{t('addHeading')}</h3>
        <input
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          placeholder={t('namePlaceholder')}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
          placeholder={t('urlPlaceholder')}
          value={url}
          maxLength={2048}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('colorLabel')}</span>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t('pickColorAria', { color: c })}
              onClick={() => setColor(c)}
              className={`size-5 rounded-full border-2 transition ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void add()} disabled={busy}>
            <Plus className="size-3.5" />
            {t('addCalendar')}
          </Button>
        </div>
      </div>
    </div>
  );
}
