'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { listUpcomingEvents, type CalendarEvent } from '@/server/actions/calendar-subs';

/**
 * "Today on your calendar" — pulls events from every enabled iCal
 * subscription and groups them into Today / Tomorrow / Later. Hides
 * the whole card if no events are returned.
 */
export function CalendarTodayCard() {
  const t = useTranslations('dashboard.calendarToday');
  const [events, setEvents] = React.useState<CalendarEvent[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listUpcomingEvents(7);
        if (!cancelled) setEvents(list);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (events == null || events.length === 0) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = startOfToday + 86_400_000;
  const startOfDayAfter = startOfTomorrow + 86_400_000;

  const today: CalendarEvent[] = [];
  const tomorrow: CalendarEvent[] = [];
  const later: CalendarEvent[] = [];
  for (const ev of events) {
    const ts = new Date(ev.start).getTime();
    if (ts < startOfTomorrow) today.push(ev);
    else if (ts < startOfDayAfter) tomorrow.push(ev);
    else later.push(ev);
  }

  return (
    <section className="bg-card rounded-2xl border p-5 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <Calendar className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <Link
          href="/app/calendars"
          className="text-muted-foreground hover:text-foreground ml-auto text-xs"
        >
          {t('manage')}
        </Link>
      </header>
      <div className="space-y-4">
        {today.length > 0 && <Section title={t('today')} items={today} />}
        {tomorrow.length > 0 && <Section title={t('tomorrow')} items={tomorrow} />}
        {later.length > 0 && <Section title={t('next7Days')} items={later.slice(0, 8)} />}
      </div>
    </section>
  );
}

function Section({ title, items }: { title: string; items: CalendarEvent[] }) {
  const t = useTranslations('dashboard.calendarToday');
  return (
    <div>
      <h3 className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((ev) => (
          <li key={ev.id} className="flex items-start gap-3 text-sm">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: ev.subscriptionColor ?? '#6366f1' }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                  {formatTime(ev, t)}
                </span>
                <span className="truncate">{ev.title}</span>
              </div>
              {ev.location && (
                <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                  <MapPin className="size-3" />
                  <span className="truncate">{ev.location}</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTime(ev: CalendarEvent, t: (k: string) => string): string {
  if (ev.allDay) return t('allDay');
  const d = new Date(ev.start);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
