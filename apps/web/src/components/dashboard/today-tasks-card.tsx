'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarClock, AlertTriangle, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { listTasks, type Task } from '@/server/actions/tasks';

/**
 * Today's tasks. Surfaces every `[ ] …` line tagged with
 * `@due(YYYY-MM-DD)` for today or earlier, sorted overdue-first.
 * Hidden when there's nothing due — never shames an empty day.
 */
export function TodayTasksCard() {
  const t = useTranslations('dashboard.todayTasks');
  const [overdue, setOverdue] = React.useState<Task[] | null>(null);
  const [today, setToday] = React.useState<Task[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      listTasks({ range: 'overdue', limit: 8 }),
      listTasks({ range: 'today', limit: 8 }),
    ])
      .then(([o, t]) => {
        if (cancelled) return;
        setOverdue(o);
        setToday(t);
      })
      .catch(() => {
        if (cancelled) return;
        setOverdue([]);
        setToday([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!overdue || !today) return null;
  if (overdue.length === 0 && today.length === 0) return null;

  return (
    <div className="bg-card mb-3 overflow-hidden rounded-2xl border">
      <div className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide">
        <CalendarClock className="size-3.5" />
        <span>{t('header', { count: overdue.length + today.length })}</span>
      </div>

      {overdue.length > 0 && (
        <ul className="divide-y">
          {overdue.map((t, i) => (
            <li key={`o-${i}`}>
              <TaskRow task={t} flavour="overdue" />
            </li>
          ))}
        </ul>
      )}
      {today.length > 0 && (
        <ul className="divide-y">
          {today.map((t, i) => (
            <li key={`t-${i}`}>
              <TaskRow task={t} flavour="today" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, flavour }: { task: Task; flavour: 'overdue' | 'today' }) {
  const t = useTranslations('dashboard.todayTasks');
  return (
    <Link
      href={`/app/n/${task.noteId}`}
      className="hover:bg-muted/50 flex items-center gap-3 px-4 py-2.5 text-sm transition"
    >
      <span aria-hidden className="size-4 shrink-0 text-center">
        {flavour === 'overdue' ? (
          <AlertTriangle className="size-4 text-amber-500" />
        ) : (
          <span className="border-foreground/30 inline-block size-3.5 rounded-sm border" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="truncate">{task.text}</span>
      </span>
      {task.priority && (
        <span
          className={
            task.priority === 'high'
              ? 'text-[10px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400'
              : task.priority === 'med'
                ? 'text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground text-[10px] font-medium uppercase tracking-wide'
          }
        >
          {task.priority === 'high'
            ? t('priorityHigh')
            : task.priority === 'med'
              ? t('priorityMed')
              : t('priorityLow')}
        </span>
      )}
      {task.recurrence && (
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
          {task.recurrence}
        </span>
      )}
      {task.estimateMin && (
        <span
          className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300"
          title={
            task.estimateMin === 1
              ? t('estimateTitleOne', { count: task.estimateMin })
              : t('estimateTitleOther', { count: task.estimateMin })
          }
        >
          {task.estimateMin >= 60
            ? `${Math.round(task.estimateMin / 60)}h`
            : `${task.estimateMin}m`}
        </span>
      )}
      <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
        <FileText className="size-3 opacity-60" />
        <span className="max-w-[140px] truncate">
          {task.noteIcon ? `${task.noteIcon} ` : ''}
          {task.noteTitle || t('untitled')}
        </span>
      </span>
      <span
        className={
          flavour === 'overdue'
            ? 'ml-1 text-xs font-medium text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground ml-1 text-xs'
        }
      >
        {flavour === 'overdue'
          ? task.daysUntil === -1
            ? t('yesterday')
            : t('daysAgo', { count: Math.abs(task.daysUntil ?? 0) })
          : t('todayLabel')}
      </span>
    </Link>
  );
}
