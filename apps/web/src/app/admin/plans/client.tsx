'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { RefreshCw, Cloud, Plus, X, Save, RotateCcw } from 'lucide-react';
import { Button, Input, Badge, Textarea } from '@notai/ui';
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

const CURRENCIES = ['eur', 'usd', 'ron'] as const;
type Currency = (typeof CURRENCIES)[number];
const CURRENCY_LABEL: Record<Currency, string> = { eur: 'EUR', usd: 'USD', ron: 'RON' };
const CURRENCY_SYMBOL: Record<Currency, string> = { eur: '€', usd: '$', ron: 'RON' };

const LIMIT_FIELDS: { key: string; label: string; unit: 'count' | 'mb' | 'days' }[] = [
  { key: 'notesCloud', label: 'Cloud notes', unit: 'count' },
  { key: 'attachmentBytes', label: 'Storage', unit: 'mb' },
  { key: 'historyDays', label: 'History', unit: 'days' },
  { key: 'devices', label: 'Devices', unit: 'count' },
  { key: 'stickiesOpen', label: 'Stickies open', unit: 'count' },
  { key: 'aiActionsMonthly', label: 'AI actions / mo', unit: 'count' },
];

const MB = 1024 * 1024;

function limitToInput(value: number | null | undefined, unit: 'count' | 'mb' | 'days'): string {
  if (value === null || value === undefined) return '';
  if (unit === 'mb') return String(Math.round(value / MB));
  return String(value);
}

function inputToLimit(input: string, unit: 'count' | 'mb' | 'days'): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  if (unit === 'mb') return Math.round(n) * MB;
  return Math.round(n);
}

export function PlansClient({ plans: initial }: { plans: PlanRow[] }) {
  const [plans, setPlans] = React.useState(initial);
  const [pending, start] = React.useTransition();

  return (
    <div>
      <div className="flex items-center justify-between border-b p-4">
        <div className="text-muted-foreground text-xs">
          {plans.length} plan{plans.length === 1 ? '' : 's'} · prices stored in cents/bani · Stripe
          sync writes products & active prices.
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const result = await adminSyncAllPlansAction();
                const products = result.filter((r) => r.productCreated || r.productUpdated).length;
                const prices = result.reduce((s, r) => s + r.pricesCreated, 0);
                toast.success(
                  `Synced ${products} product${products === 1 ? '' : 's'}, ${prices} price${prices === 1 ? '' : 's'}`,
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
          <PlanCard
            key={plan.id}
            plan={plan}
            index={i}
            pending={pending}
            onPlanChange={(next) =>
              setPlans((prev) => prev.map((p) => (p.id === plan.id ? next : p)))
            }
            onSync={() =>
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
            startTransition={start}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  index,
  pending,
  onPlanChange,
  onSync,
  startTransition,
}: {
  plan: PlanRow;
  index: number;
  pending: boolean;
  onPlanChange: (next: PlanRow) => void;
  onSync: () => void;
  startTransition: React.TransitionStartFunction;
}) {
  const isFree = plan.slug === 'free';
  const availableCurrencies = React.useMemo(() => {
    const set = new Set<Currency>(plan.prices.map((p) => p.currency as Currency));
    const ordered = CURRENCIES.filter((c) => set.has(c));
    return ordered.length > 0 ? ordered : (CURRENCIES as readonly Currency[]).slice();
  }, [plan.prices]);

  const [currency, setCurrency] = React.useState<Currency>(availableCurrencies[0] ?? 'eur');
  const [draft, setDraft] = React.useState(() => toDraft(plan));

  React.useEffect(() => {
    setDraft(toDraft(plan));
  }, [plan]);

  const dirty = isDirty(plan, draft);

  const monthPrice = plan.prices.find((p) => p.currency === currency && p.interval === 'month');
  const yearPrice = plan.prices.find((p) => p.currency === currency && p.interval === 'year');

  const monthDraft = draft.prices[monthPrice?.id ?? ''];
  const yearDraft = draft.prices[yearPrice?.id ?? ''];

  function save() {
    startTransition(async () => {
      try {
        const planChanged =
          plan.displayName !== draft.displayName ||
          (plan.description ?? '') !== draft.description ||
          plan.trialDays !== draft.trialDays ||
          plan.isActive !== draft.isActive ||
          !arraysEqual(plan.features ?? [], draft.features) ||
          !limitsEqual(plan.limits, draft.limits);

        if (planChanged) {
          await updatePlan({
            planId: plan.id,
            displayName: draft.displayName,
            description: draft.description,
            features: draft.features,
            limits: draft.limits,
            isActive: draft.isActive,
            trialDays: draft.trialDays,
          });
        }

        const priceUpdates = plan.prices
          .map((price) => {
            const d = draft.prices[price.id];
            if (!d) return null;
            const changed = d.unitAmount !== price.unitAmount || d.isActive !== price.isActive;
            return changed ? { id: price.id, ...d } : null;
          })
          .filter((x): x is { id: string; unitAmount: number; isActive: boolean } => x !== null);

        await Promise.all(
          priceUpdates.map((u) =>
            updatePrice({ priceId: u.id, unitAmount: u.unitAmount, isActive: u.isActive }),
          ),
        );

        const next: PlanRow = {
          ...plan,
          displayName: draft.displayName,
          description: draft.description,
          features: draft.features,
          limits: draft.limits,
          isActive: draft.isActive,
          trialDays: draft.trialDays,
          prices: plan.prices.map((p) => {
            const d = draft.prices[p.id];
            return d ? { ...p, unitAmount: d.unitAmount, isActive: d.isActive } : p;
          }),
        };
        onPlanChange(next);
        toast.success(
          `Saved ${plan.slug}${priceUpdates.length ? ` · ${priceUpdates.length} price${priceUpdates.length === 1 ? '' : 's'}` : ''} · sync to push to Stripe`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="bg-background/50 relative flex flex-col rounded-xl border"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0 flex-1">
          <Input
            value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            className="h-9 border-0 bg-transparent p-0 font-serif text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0"
          />
          <code className="text-muted-foreground text-[10px]">{plan.slug}</code>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}
            className="transition"
            title="Toggle visibility"
          >
            {draft.isActive ? (
              <Badge
                variant="outline"
                className="cursor-pointer border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="cursor-pointer">
                Hidden
              </Badge>
            )}
          </button>
          {plan.stripeProductId ? (
            <Badge variant="outline" className="text-[9px]" title={plan.stripeProductId}>
              {plan.stripeProductId.slice(0, 14)}…
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px]">
              not on Stripe
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Description */}
        <div>
          <Label>Description</Label>
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            className="mt-1 text-xs"
          />
        </div>

        {/* Pricing */}
        {!isFree ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Pricing</Label>
              <div className="bg-muted/40 inline-flex rounded-md p-0.5">
                {availableCurrencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={
                      'rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition ' +
                      (currency === c
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {CURRENCY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PriceField
                label="Monthly"
                currency={currency}
                price={monthPrice}
                draft={monthDraft}
                onChange={(d) =>
                  monthPrice
                    ? setDraft({
                        ...draft,
                        prices: { ...draft.prices, [monthPrice.id]: d },
                      })
                    : null
                }
              />
              <PriceField
                label="Yearly"
                currency={currency}
                price={yearPrice}
                draft={yearDraft}
                onChange={(d) =>
                  yearPrice
                    ? setDraft({
                        ...draft,
                        prices: { ...draft.prices, [yearPrice.id]: d },
                      })
                    : null
                }
              />
            </div>
            {monthDraft && yearDraft ? (
              <p className="text-muted-foreground mt-1.5 text-[10px]">
                Yearly equivalent ÷ 12:{' '}
                <span className="tabular-nums">
                  {CURRENCY_SYMBOL[currency]} {(yearDraft.unitAmount / 100 / 12).toFixed(2)}
                </span>
                {monthDraft.unitAmount > 0 ? (
                  <>
                    {' '}
                    · {Math.round((1 - yearDraft.unitAmount / 12 / monthDraft.unitAmount) * 100)}%
                    off
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="bg-muted/30 text-muted-foreground rounded-md p-3 text-center text-xs">
            Free plan · no prices
          </div>
        )}

        {/* Trial */}
        {!isFree ? (
          <div>
            <Label>Trial period</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={draft.trialDays}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trialDays: Math.max(0, parseInt(e.target.value || '0', 10) || 0),
                  })
                }
                className="h-8 w-20 text-xs"
              />
              <span className="text-muted-foreground text-xs">days</span>
            </div>
          </div>
        ) : null}

        {/* Limits */}
        <div>
          <Label>Limits</Label>
          <p className="text-muted-foreground mb-1.5 text-[10px]">
            Empty = unlimited. Enforced server-side.
          </p>
          <div className="space-y-1.5">
            {LIMIT_FIELDS.map((f) => {
              const value = draft.limits[f.key] ?? null;
              return (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="flex-1 text-xs">{f.label}</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={limitToInput(value, f.unit)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        limits: {
                          ...draft.limits,
                          [f.key]: inputToLimit(e.target.value, f.unit),
                        },
                      })
                    }
                    className="h-7 w-24 text-xs tabular-nums"
                  />
                  <span className="text-muted-foreground w-8 text-[10px] uppercase tracking-wider">
                    {f.unit === 'mb' ? 'MB' : f.unit === 'days' ? 'days' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Features */}
        <div>
          <Label>Features</Label>
          <p className="text-muted-foreground mb-1.5 text-[10px]">
            Shown on the public pricing page.
          </p>
          <ul className="space-y-1.5">
            {draft.features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <Input
                  value={feat}
                  onChange={(e) => {
                    const next = [...draft.features];
                    next[idx] = e.target.value;
                    setDraft({ ...draft, features: next });
                  }}
                  className="h-7 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      features: draft.features.filter((_, i) => i !== idx),
                    })
                  }
                  className="text-muted-foreground transition hover:text-rose-500"
                  title="Remove feature"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, features: [...draft.features, ''] })}
            className="text-muted-foreground hover:text-foreground mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition"
          >
            <Plus className="size-3" />
            Add feature
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="bg-muted/20 mt-auto flex items-center gap-2 rounded-b-xl border-t p-3">
        <Button size="sm" disabled={pending || !dirty} onClick={save} className="flex-1">
          <Save className="mr-1.5 size-3.5" />
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setDraft(toDraft(plan))}
            title="Discard changes"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !plan.prices.length}
          onClick={onSync}
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          Sync
        </Button>
      </div>
    </motion.div>
  );
}

function PriceField({
  label,
  currency,
  price,
  draft,
  onChange,
}: {
  label: string;
  currency: Currency;
  price: PriceRow | undefined;
  draft: { unitAmount: number; isActive: boolean } | undefined;
  onChange: (next: { unitAmount: number; isActive: boolean }) => void;
}) {
  if (!price || !draft) {
    return (
      <div className="bg-muted/30 rounded-md p-2.5">
        <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
        <div className="text-muted-foreground mt-1 text-xs">no price</div>
      </div>
    );
  }
  return (
    <div className="bg-muted/30 rounded-md p-2.5">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
        <button
          type="button"
          onClick={() => onChange({ ...draft, isActive: !draft.isActive })}
          className={
            'text-[9px] uppercase tracking-wider transition ' +
            (draft.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')
          }
          title="Toggle active"
        >
          {draft.isActive ? 'on' : 'off'}
        </button>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">{CURRENCY_SYMBOL[currency]}</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={(draft.unitAmount / 100).toFixed(2)}
          onChange={(e) =>
            onChange({
              ...draft,
              unitAmount: Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)),
            })
          }
          className="h-7 flex-1 text-xs tabular-nums"
        />
      </div>
      {price.stripePriceId ? (
        <div className="text-muted-foreground mt-1 truncate text-[9px]" title={price.stripePriceId}>
          {price.stripePriceId}
        </div>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
      {children}
    </div>
  );
}

interface Draft {
  displayName: string;
  description: string;
  features: string[];
  limits: Record<string, number | null>;
  isActive: boolean;
  trialDays: number;
  prices: Record<string, { unitAmount: number; isActive: boolean }>;
}

function toDraft(plan: PlanRow): Draft {
  return {
    displayName: plan.displayName,
    description: plan.description ?? '',
    features: [...(plan.features ?? [])],
    limits: { ...(plan.limits ?? {}) },
    isActive: plan.isActive,
    trialDays: plan.trialDays,
    prices: Object.fromEntries(
      plan.prices.map((p) => [p.id, { unitAmount: p.unitAmount, isActive: p.isActive }]),
    ),
  };
}

function isDirty(plan: PlanRow, draft: Draft): boolean {
  if (
    plan.displayName !== draft.displayName ||
    (plan.description ?? '') !== draft.description ||
    plan.isActive !== draft.isActive ||
    plan.trialDays !== draft.trialDays
  ) {
    return true;
  }
  if (!arraysEqual(plan.features ?? [], draft.features)) return true;
  if (!limitsEqual(plan.limits, draft.limits)) return true;
  for (const price of plan.prices) {
    const d = draft.prices[price.id];
    if (!d) continue;
    if (d.unitAmount !== price.unitAmount || d.isActive !== price.isActive) return true;
  }
  return false;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function limitsEqual(a: Record<string, number | null>, b: Record<string, number | null>): boolean {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const av = a?.[k] ?? null;
    const bv = b?.[k] ?? null;
    if (av !== bv) return false;
  }
  return true;
}
