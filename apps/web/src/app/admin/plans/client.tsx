'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { RefreshCw, Save, Cloud } from 'lucide-react';
import { Button, Input, Badge } from '@notai/ui';
import {
  adminSyncAllPlansAction,
  adminSyncPlanAction,
  updatePlan,
  updatePrice,
} from '@/server/actions/admin';

interface PriceRow {
  id: string;
  currency: string;
  interval: string;
  unitAmount: number;
  isActive: boolean;
  stripePriceId: string | null;
}
interface PlanRow {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  features: string[] | null;
  limits: Record<string, number | null>;
  isActive: boolean;
  trialDays: number;
  stripeProductId: string | null;
  prices: PriceRow[];
}

const SYMBOL: Record<string, string> = { eur: '€', usd: '$', ron: 'RON ' };

export function PlansClient({ plans: initial }: { plans: PlanRow[] }) {
  const [plans, setPlans] = React.useState(initial);
  const [pending, start] = React.useTransition();

  return (
    <div>
      <div className="flex items-center justify-between border-b p-4">
        <div className="text-muted-foreground text-xs">
          {plans.length} plan{plans.length === 1 ? '' : 's'} · Stripe sync writes products & prices
          for every active row.
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const result = await adminSyncAllPlansAction();
                const totalProducts = result.filter(
                  (r) => r.productCreated || r.productUpdated,
                ).length;
                const totalPrices = result.reduce((s, r) => s + r.pricesCreated, 0);
                toast.success(
                  `Synced ${totalProducts} product${totalProducts === 1 ? '' : 's'}, ${totalPrices} price${totalPrices === 1 ? '' : 's'}`,
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Sync failed');
              }
            })
          }
        >
          <Cloud className="mr-1.5 size-3.5" />
          Sync all to Stripe
        </Button>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="bg-background/50 rounded-xl border p-4"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-serif text-lg font-semibold tracking-tight">
                  {plan.displayName}
                </h3>
                <code className="text-muted-foreground text-[10px]">{plan.slug}</code>
              </div>
              <div className="flex items-center gap-1.5">
                {plan.isActive ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  >
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Hidden</Badge>
                )}
                {plan.stripeProductId ? (
                  <Badge variant="outline" className="text-[10px]">
                    {plan.stripeProductId.slice(0, 12)}…
                  </Badge>
                ) : null}
              </div>
            </div>

            {plan.description ? (
              <p className="text-muted-foreground mb-3 text-xs">{plan.description}</p>
            ) : null}

            {plan.prices.length > 0 ? (
              <div className="mb-3 space-y-2">
                {plan.prices.map((price) => (
                  <PriceEditor
                    key={price.id}
                    price={price}
                    pending={pending}
                    onSave={(unitAmount, isActive) => {
                      start(async () => {
                        try {
                          await updatePrice({ priceId: price.id, unitAmount, isActive });
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.id === plan.id
                                ? {
                                    ...p,
                                    prices: p.prices.map((pr) =>
                                      pr.id === price.id ? { ...pr, unitAmount, isActive } : pr,
                                    ),
                                  }
                                : p,
                            ),
                          );
                          toast.success('Price updated (sync to push to Stripe)');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed');
                        }
                      });
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-4 text-center text-xs">
                Free plan · no prices
              </div>
            )}

            {plan.limits ? (
              <details className="text-muted-foreground mb-3 text-xs">
                <summary className="hover:text-foreground cursor-pointer transition">
                  Limits
                </summary>
                <pre className="bg-muted/40 mt-1.5 overflow-x-auto rounded p-2 text-[10px]">
                  {JSON.stringify(plan.limits, null, 2)}
                </pre>
              </details>
            ) : null}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !plan.prices.length}
                className="flex-1"
                onClick={() =>
                  start(async () => {
                    try {
                      const result = await adminSyncPlanAction(plan.id);
                      toast.success(
                        `Synced ${plan.slug}: ${result.pricesCreated} new, ${result.pricesSkipped} unchanged`,
                      );
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Sync failed');
                    }
                  })
                }
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Sync
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      await updatePlan({ planId: plan.id, isActive: !plan.isActive });
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.id === plan.id ? { ...p, isActive: !plan.isActive } : p,
                        ),
                      );
                      toast.success(plan.isActive ? 'Plan hidden' : 'Plan activated');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    }
                  })
                }
              >
                {plan.isActive ? 'Hide' : 'Show'}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PriceEditor({
  price,
  pending,
  onSave,
}: {
  price: PriceRow;
  pending: boolean;
  onSave: (unitAmount: number, isActive: boolean) => void;
}) {
  const [amount, setAmount] = React.useState((price.unitAmount / 100).toFixed(2));
  const [isActive, setIsActive] = React.useState(price.isActive);
  const dirty = parseFloat(amount) !== price.unitAmount / 100 || isActive !== price.isActive;

  return (
    <div className="bg-muted/30 flex items-center gap-2 rounded-lg p-2">
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium uppercase">{price.currency}</span>
          <span className="text-muted-foreground">/ {price.interval}</span>
          {!price.isActive ? (
            <Badge variant="secondary" className="text-[9px]">
              archived
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">{SYMBOL[price.currency] ?? ''}</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-7 w-20 text-xs"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIsActive((v) => !v)}
        className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider transition"
      >
        {isActive ? 'enabled' : 'disabled'}
      </button>
      {dirty ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => onSave(Math.round(parseFloat(amount) * 100), isActive)}
        >
          <Save className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
