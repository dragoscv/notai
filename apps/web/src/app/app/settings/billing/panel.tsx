'use client';
import * as React from 'react';
import { Check, ExternalLink, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@notai/ui';
import { startCheckout, openBillingPortal } from '@/server/actions/billing';

interface PlanInfo {
  tier: 'free' | 'pro' | 'teams';
  status: string;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
}

export function BillingPanel({ plan }: { plan: PlanInfo }) {
  const t = useTranslations('settings.pages.billing');
  const PRO_FEATURES = [
    t('feature1'),
    t('feature2'),
    t('feature3'),
    t('feature4'),
    t('feature5'),
    t('feature6'),
  ];
  const [pending, startTransition] = React.useTransition();
  const [interval, setInterval] = React.useState<'monthly' | 'yearly'>('yearly');

  const upgrade = () =>
    startTransition(async () => {
      try {
        await startCheckout({ interval });
      } catch (err) {
        toast.error((err as Error).message);
      }
    });

  const portal = () =>
    startTransition(async () => {
      try {
        await openBillingPortal();
      } catch (err) {
        toast.error((err as Error).message);
      }
    });

  const isPro = plan.tier === 'pro';
  const periodEnd = plan.currentPeriodEnd
    ? new Date(plan.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('currentlyOnPrefix')} <strong>{isPro ? t('planPro') : t('planFree')}</strong>{' '}
          {t('currentlyOnSuffix')}
          {plan.status !== 'active' && plan.status !== 'trialing' ? (
            <span className="text-destructive"> ({plan.status})</span>
          ) : null}
          .{periodEnd ? <> {t('renewsOn', { date: periodEnd })}</> : null}
        </p>
      </header>

      {isPro ? (
        <section className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Sparkles className="size-5" />
            <h2 className="text-lg font-semibold">{t('proHeading')}</h2>
          </div>
          {plan.cancelAtPeriodEnd ? (
            <p className="mt-2 text-sm">{t('cancelling')}</p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">{t('thanks')}</p>
          )}
          <Button onClick={portal} disabled={pending} className="mt-4">
            <ExternalLink className="mr-1 size-4" />
            {t('manageSubscription')}
          </Button>
        </section>
      ) : (
        <section className="bg-card space-y-4 rounded-2xl border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('upgradeHeading')}</h2>
            <div className="flex gap-1 rounded-full border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setInterval('monthly')}
                className={`rounded-full px-3 py-1 ${interval === 'monthly' ? 'bg-foreground text-background' : ''}`}
              >
                {t('monthly')}
              </button>
              <button
                type="button"
                onClick={() => setInterval('yearly')}
                className={`rounded-full px-3 py-1 ${interval === 'yearly' ? 'bg-foreground text-background' : ''}`}
              >
                {t('yearly')}
              </button>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="size-4 text-emerald-600" /> {f}
              </li>
            ))}
          </ul>
          <Button onClick={upgrade} disabled={pending} className="w-full sm:w-auto">
            {pending
              ? t('redirecting')
              : interval === 'yearly'
                ? t('upgradeYearly')
                : t('upgradeMonthly')}
          </Button>
          <a
            href="/pricing"
            className="text-muted-foreground hover:text-foreground ml-2 text-xs underline-offset-4 hover:underline"
          >
            {t('compareAll')}
          </a>
        </section>
      )}

      <p className="text-muted-foreground text-xs">{t('stripeNote')}</p>
    </div>
  );
}
