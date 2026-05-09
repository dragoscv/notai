'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@notai/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  index = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: number; label?: string };
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.04 * index, ease: 'easeOut' }}
      className="bg-card/60 hover:border-foreground/20 group relative overflow-hidden rounded-2xl border p-5 backdrop-blur transition"
    >
      <div className="from-primary/5 absolute inset-0 -z-10 bg-gradient-to-br via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {trend ? (
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              trend.value > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : trend.value < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground',
            )}
          >
            {trend.value > 0 ? '+' : ''}
            {trend.value}%{trend.label ? ` ${trend.label}` : ''}
          </span>
        ) : null}
      </div>
      {hint ? <div className="text-muted-foreground/80 mt-1 text-xs">{hint}</div> : null}
    </motion.div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card/40 mb-6 overflow-hidden rounded-2xl border backdrop-blur">
      {title || actions ? (
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <div>
            {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
            {description ? (
              <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div>{children}</div>
    </section>
  );
}

export function DataTable<T extends { id?: string }>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: {
    key: string;
    label: string;
    render: (row: T) => React.ReactNode;
    className?: string;
  }[];
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground p-10 text-center text-sm">{empty ?? 'No data.'}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-2.5 text-left font-medium', c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="hover:bg-muted/30 transition">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
