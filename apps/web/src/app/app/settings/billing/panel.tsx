'use client';
import * as React from 'react';
import { Check, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui';
import { startCheckout, openBillingPortal } from '@/server/actions/billing';

interface PlanInfo {
  tier: 'free' | 'pro';
  status: string;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
}

const PRO_FEATURES = [
  'Unlimited notes & stickies',
  'Realtime collaboration on every note',
  '"Ask my notes" with vector search',
  'Voice-to-note (Whisper) — 5 hours/month',
  'Version history (90 days)',
  'Priority support',
];

export function BillingPanel({ plan }: { plan: PlanInfo }) {
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
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          You're currently on the <strong>{isPro ? 'Pro' : 'Free'}</strong> plan
          {plan.status !== 'active' && plan.status !== 'trialing' ? (
            <span className="text-destructive"> ({plan.status})</span>
          ) : null}
          .
          {periodEnd ? <> Renews {periodEnd}.</> : null}
        </p>
      </header>

      {isPro ? (
        <section className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Sparkles className="size-5" />
            <h2 className="text-lg font-semibold">Notai Pro</h2>
          </div>
          {plan.cancelAtPeriodEnd ? (
            <p className="mt-2 text-sm">
              Your subscription is set to cancel at the end of the current period.
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              Thanks for supporting Notai 🙏
            </p>
          )}
          <Button onClick={portal} disabled={pending} className="mt-4">
            <ExternalLink className="mr-1 size-4" />
            Manage subscription
          </Button>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upgrade to Pro</h2>
            <div className="flex gap-1 rounded-full border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setInterval('monthly')}
                className={`rounded-full px-3 py-1 ${interval === 'monthly' ? 'bg-foreground text-background' : ''}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setInterval('yearly')}
                className={`rounded-full px-3 py-1 ${interval === 'yearly' ? 'bg-foreground text-background' : ''}`}
              >
                Yearly · save 17%
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
            {pending ? 'Redirecting…' : `Upgrade — ${interval === 'yearly' ? '$60/yr' : '$6/mo'}`}
          </Button>
        </section>
      )}

      <p className="text-muted-foreground text-xs">
        Payments are processed by Stripe. We never see your card details.
      </p>
    </div>
  );
}
