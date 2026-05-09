'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { FileText, HardDrive, Smartphone, Sparkles } from 'lucide-react';
import { cn } from '@notai/lib/utils';

interface UsageQuota {
  used: number;
  limit: number | null;
}
export interface UsageData {
  notes: UsageQuota;
  attachments: UsageQuota;
  devices: UsageQuota;
  ai: UsageQuota & { periodStart: string };
  history: { days: number | null };
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

interface BarProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  used: number;
  limit: number | null;
  formatValue?: (n: number) => string;
  index?: number;
}

function UsageBar({ icon: Icon, label, used, limit, formatValue, index = 0 }: BarProps) {
  const fmt = formatValue ?? ((n: number) => n.toLocaleString());
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, limit === 0 ? 0 : (used / limit) * 100);
  const danger = pct >= 90;
  const warn = pct >= 75 && !danger;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: 'easeOut' }}
      className="bg-card/40 rounded-xl border p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {fmt(used)}
          {isUnlimited ? (
            <span className="text-primary ml-1 font-medium">· unlimited</span>
          ) : (
            <span> / {fmt(limit)}</span>
          )}
        </span>
      </div>
      <div className="bg-muted/60 mt-3 h-1.5 overflow-hidden rounded-full">
        {!isUnlimited ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + index * 0.05 }}
            className={cn(
              'h-full rounded-full',
              danger
                ? 'bg-rose-500'
                : warn
                  ? 'bg-amber-500'
                  : 'from-primary/70 to-primary bg-gradient-to-r',
            )}
          />
        ) : (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + index * 0.05 }}
            className="from-primary/40 via-primary to-primary/40 h-full rounded-full bg-gradient-to-r"
          />
        )}
      </div>
    </motion.div>
  );
}

export function UsageSection({
  usage,
  tier,
}: {
  usage: UsageData;
  tier: 'free' | 'pro' | 'teams';
}) {
  const periodLabel = new Date(usage.ai.periodStart).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Usage</h2>
          <p className="text-muted-foreground text-xs">
            {tier === 'free'
              ? 'Free plan limits. Upgrade for unlimited.'
              : 'Your plan limits and current usage.'}
          </p>
        </div>
        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
          {periodLabel}
        </span>
      </header>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <UsageBar
          icon={FileText}
          label="Cloud notes"
          used={usage.notes.used}
          limit={usage.notes.limit}
          index={0}
        />
        <UsageBar
          icon={HardDrive}
          label="Attachments"
          used={usage.attachments.used}
          limit={usage.attachments.limit}
          formatValue={fmtBytes}
          index={1}
        />
        <UsageBar
          icon={Smartphone}
          label="Devices"
          used={usage.devices.used}
          limit={usage.devices.limit}
          index={2}
        />
        <UsageBar
          icon={Sparkles}
          label="AI actions (this month)"
          used={usage.ai.used}
          limit={usage.ai.limit}
          index={3}
        />
      </div>
      {usage.history.days !== null ? (
        <p className="text-muted-foreground text-xs">
          Version history retained for{' '}
          <strong className="text-foreground">{usage.history.days} days</strong>.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Version history is <strong className="text-primary">unlimited</strong> on your plan.
        </p>
      )}
    </section>
  );
}
