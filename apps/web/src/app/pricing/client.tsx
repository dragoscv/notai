'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui';
import { cn } from '@notai/lib/utils';
import { startDynamicCheckout } from '@/server/actions/billing';
import type { PublicPlan } from '@/server/public-plans';

type Currency = 'eur' | 'usd' | 'ron';
type Interval = 'month' | 'year';

const CURRENCY_LABEL: Record<Currency, { symbol: string; label: string }> = {
  eur: { symbol: '€', label: 'EUR' },
  usd: { symbol: '$', label: 'USD' },
  ron: { symbol: 'RON ', label: 'RON' },
};

function detectCurrency(): Currency {
  if (typeof navigator === 'undefined') return 'eur';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('ro')) return 'ron';
  if (lang === 'en-us' || lang === 'en-ca') return 'usd';
  return 'eur';
}

function formatPrice(minor: number, currency: Currency) {
  const major = minor / 100;
  return `${CURRENCY_LABEL[currency].symbol}${major.toLocaleString(undefined, {
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  })}`;
}

export function PricingClient({ plans, signedIn }: { plans: PublicPlan[]; signedIn: boolean }) {
  const [currency, setCurrency] = React.useState<Currency>('eur');
  const [interval, setInterval] = React.useState<Interval>('year');
  const [pending, start] = React.useTransition();
  const [pendingSlug, setPendingSlug] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => setCurrency(detectCurrency()), []);

  const upgrade = (slug: 'pro' | 'teams') => {
    if (!signedIn) {
      router.push(`/signin?callbackUrl=${encodeURIComponent('/pricing')}`);
      return;
    }
    setPendingSlug(slug);
    start(async () => {
      try {
        await startDynamicCheckout({
          planSlug: slug,
          interval,
          currency,
          quantity: 1,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Checkout failed');
      } finally {
        setPendingSlug(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="text-center"
      >
        <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
          Pricing as simple as the app.
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
          Free forever for personal use. Pro unlocks AI, unlimited storage, and collaboration.
        </p>
      </motion.div>

      <div className="mt-10 flex items-center justify-center gap-3">
        <div className="bg-muted/50 flex gap-1 rounded-full border p-1">
          {(['month', 'year'] as const).map((i) => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className={cn(
                'relative rounded-full px-4 py-1.5 text-sm font-medium transition',
                interval === i ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {interval === i ? (
                <motion.span
                  layoutId="pricing-interval"
                  className="bg-background absolute inset-0 -z-10 rounded-full shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ) : null}
              {i === 'month' ? 'Monthly' : 'Yearly'}
              {i === 'year' ? (
                <span className="text-primary ml-1.5 text-[10px] font-semibold uppercase">
                  save ~17%
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="bg-muted/50 flex gap-0.5 rounded-full border p-1">
          {(Object.keys(CURRENCY_LABEL) as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                'relative rounded-full px-3 py-1.5 text-xs font-medium uppercase transition',
                currency === c ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {currency === c ? (
                <motion.span
                  layoutId="pricing-currency"
                  className="bg-background absolute inset-0 -z-10 rounded-full shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ) : null}
              {CURRENCY_LABEL[c].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const price = plan.prices.find((p) => p.currency === currency && p.interval === interval);
          const isFree = plan.slug === 'free';
          const isPro = plan.slug === 'pro';
          return (
            <motion.div
              key={plan.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i, ease: 'easeOut' }}
              className={cn(
                'bg-card/60 relative flex flex-col rounded-2xl border p-6 backdrop-blur transition',
                isPro
                  ? 'border-primary/40 shadow-primary/10 shadow-lg'
                  : 'hover:border-foreground/20',
              )}
            >
              {isPro ? (
                <div className="from-primary to-primary/70 absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-gradient-to-r px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                  <Sparkles className="size-3" />
                  Most popular
                </div>
              ) : null}

              <div>
                <h3 className="font-serif text-2xl font-semibold tracking-tight">
                  {plan.displayName}
                </h3>
                {plan.description ? (
                  <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>
                ) : null}
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                {isFree ? (
                  <span className="font-serif text-4xl font-semibold tracking-tight">€0</span>
                ) : price ? (
                  <>
                    <span className="font-serif text-4xl font-semibold tracking-tight">
                      {formatPrice(price.unitAmount, currency)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      / {interval === 'month' ? 'mo' : 'yr'}
                      {plan.slug === 'teams' ? ' · seat' : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Pricing not available in {currency.toUpperCase()}
                  </span>
                )}
              </div>

              {plan.trialDays > 0 ? (
                <p className="text-primary mt-1 text-xs font-medium">
                  {plan.trialDays}-day free trial · no card needed
                </p>
              ) : null}

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isFree ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={signedIn ? '/app' : '/signin'}>
                      {signedIn ? 'Open app' : 'Get started'}
                      <ArrowRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={pending || !price}
                    onClick={() => upgrade(plan.slug as 'pro' | 'teams')}
                    variant={isPro ? 'default' : 'outline'}
                  >
                    {pendingSlug === plan.slug
                      ? 'Redirecting…'
                      : plan.trialDays > 0
                        ? 'Start free trial'
                        : `Upgrade to ${plan.displayName}`}
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-muted-foreground mx-auto mt-12 max-w-xl text-center text-xs">
        Prices include VAT where applicable. Cancel anytime from the app. Payments handled by Stripe
        — we never see your card details.
      </p>
    </div>
  );
}
