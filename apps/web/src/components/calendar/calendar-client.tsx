'use client';
import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  getNotesByMonth,
  getNotesOnDay,
  type DayBucket,
  type DayNote,
} from '@/server/actions/calendar';

const WEEKDAY_KEYS = [
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
  'weekdaySun',
] as const;

function ymdUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildGrid(year: number, month: number): Date[] {
  // Mon-first grid; iterate from the Monday on/before the 1st of the
  // month, for 42 cells (6 rows). All UTC.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dow = first.getUTCDay(); // 0=Sun
  const offset = (dow + 6) % 7; // shift so Mon=0
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push(d);
  }
  return cells;
}

export function CalendarClient() {
  const t = useTranslations('appFeatures.calendar');
  const today = new Date();
  const [view, setView] = React.useState({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  const [buckets, setBuckets] = React.useState<Record<string, number>>({});
  const [selected, setSelected] = React.useState<string>(ymdUTC(today));
  const [dayNotes, setDayNotes] = React.useState<DayNote[]>([]);
  const [loadingDay, setLoadingDay] = React.useState(false);

  React.useEffect(() => {
    void getNotesByMonth(view.year, view.month).then((rows: DayBucket[]) => {
      const map: Record<string, number> = {};
      for (const r of rows) map[r.day] = r.count;
      setBuckets(map);
    });
  }, [view]);

  React.useEffect(() => {
    setLoadingDay(true);
    void getNotesOnDay(selected)
      .then(setDayNotes)
      .finally(() => setLoadingDay(false));
  }, [selected]);

  const cells = buildGrid(view.year, view.month);
  const monthLabel = new Date(Date.UTC(view.year, view.month - 1, 1)).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const navigate = (delta: number) =>
    setView(({ year, month }) => {
      const m = month + delta;
      if (m < 1) return { year: year - 1, month: 12 };
      if (m > 12) return { year: year + 1, month: 1 };
      return { year, month: m };
    });

  const todayKey = ymdUTC(today);

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="bg-card rounded-2xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-serif text-xl font-semibold">{monthLabel}</h2>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="hover:bg-muted rounded p-1.5"
              aria-label={t('previousMonth')}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setView({ year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 })
              }
              className="hover:bg-muted rounded px-2 py-1 text-xs"
            >
              {t('today')}
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="hover:bg-muted rounded p-1.5"
              aria-label={t('nextMonth')}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="text-muted-foreground mb-1 grid grid-cols-7 gap-1 text-[10px] uppercase">
          {WEEKDAY_KEYS.map((k) => (
            <div key={k} className="text-center">
              {t(k)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const key = ymdUTC(d);
            const inMonth = d.getUTCMonth() + 1 === view.month;
            const count = buckets[key] ?? 0;
            const isSelected = key === selected;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={[
                  'flex aspect-square flex-col items-start rounded-lg border p-1.5 text-left text-xs transition',
                  inMonth ? 'bg-background' : 'bg-muted/40 text-muted-foreground',
                  isSelected ? 'border-primary ring-primary/30 ring-2' : 'border-border',
                  isToday && !isSelected ? 'border-primary/60' : '',
                ].join(' ')}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className={isToday ? 'text-primary font-semibold' : 'font-medium'}>
                  {d.getUTCDate()}
                </span>
                {count > 0 && (
                  <span
                    className="bg-primary/15 text-primary mt-auto self-end rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    title={
                      count === 1 ? t('countTitleOne', { count }) : t('countTitleOther', { count })
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="bg-card rounded-2xl border p-4">
        <h3 className="font-serif text-lg font-semibold">
          {new Date(`${selected}T00:00:00.000Z`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          })}
        </h3>
        {loadingDay ? (
          <p className="text-muted-foreground mt-3 text-sm">{t('loading')}</p>
        ) : dayNotes.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">{t('noNotes')}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {dayNotes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/app/n/${n.id}`}
                  className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                >
                  <span className="size-4 shrink-0 text-center">
                    {n.icon || <FileText className="size-3.5 opacity-60" />}
                  </span>
                  <span className="truncate">{n.title || t('untitled')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
