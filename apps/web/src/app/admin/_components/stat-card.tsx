'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@notai/lib/utils';

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
