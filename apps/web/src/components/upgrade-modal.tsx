'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import { startDynamicCheckout } from '@/server/actions/billing';

export type QuotaKind = 'notes' | 'attachments' | 'devices' | 'ai' | 'pro' | 'history' | 'sticky';

interface UpgradeContext {
  reason: QuotaKind;
  used?: number;
  limit?: number;
  message?: string;
}

interface UpgradeModalContextValue {
  open: (ctx: UpgradeContext) => void;
  close: () => void;
}

const Ctx = React.createContext<UpgradeModalContextValue | null>(null);

/**
 * Reusable upgrade modal. Wrap the app shell with `<UpgradeModalProvider>`,
 * then call `useUpgradeModal().open({ reason })` from anywhere a quota
 * error fires. The modal is dynamic — it lets the user pick currency +
 * interval + plan and routes through `startDynamicCheckout`.
 */
export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = React.useState<UpgradeContext | null>(null);
  const value = React.useMemo<UpgradeModalContextValue>(
    () => ({
      open: (c) => setCtx(c),
      close: () => setCtx(null),
    }),
    [],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <UpgradeDialog ctx={ctx} onClose={() => setCtx(null)} />
    </Ctx.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalContextValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useUpgradeModal must be used inside UpgradeModalProvider');
  return v;
}

const REASON_COPY: Record<QuotaKind, { headline: string; subline: string }> = {
  notes: {
    headline: 'You hit your free cloud-notes limit.',
    subline: 'Upgrade to Pro for unlimited cloud notes and full version history.',
  },
  attachments: {
    headline: 'Your free 50 MB of attachments is full.',
    subline: 'Pro lifts you to 10 GB and enables PDF, HTML, and Notion exports.',
  },
  devices: {
    headline: "You've connected the maximum 3 devices.",
    subline: 'Pro lets you sign in on as many devices as you want.',
  },
  ai: {
    headline: 'AI is a Pro feature.',
    subline: '500 AI actions per month: summaries, action items, ask-my-notes, voice → text.',
  },
  pro: {
    headline: 'This is a Pro feature.',
    subline: 'Unlock the full Notai with a 14-day free trial — no card required.',
  },
  history: {
    headline: 'You hit your 7-day history limit.',
    subline: 'Pro keeps unlimited version history with named snapshots.',
  },
  sticky: {
    headline: 'Free plan allows 3 sticky notes open at once.',
    subline: 'Pro gives you unlimited sticky windows + custom themes.',
  },
};

type Currency = 'eur' | 'usd' | 'ron';
type Interval = 'month' | 'year';

const PRICING: Record<Currency, { symbol: string; pro: { month: number; year: number } }> = {
  eur: { symbol: '€', pro: { month: 5, year: 50 } },
  usd: { symbol: '$', pro: { month: 5, year: 50 } },
  ron: { symbol: 'RON ', pro: { month: 25, year: 250 } },
};

const PRO_BULLETS = [
  'Unlimited cloud notes',
  '10 GB of attachments',
  '500 AI actions / month',
  'Unlimited version history',
  'Public share links + custom themes',
  'PDF, HTML, Notion, .zip export',
];

function detectCurrency(): Currency {
  if (typeof navigator === 'undefined') return 'eur';
  const lang = navigator.language?.toLowerCase() ?? '';
  if (lang.startsWith('ro')) return 'ron';
  if (lang.startsWith('en-us') || lang.startsWith('en-ca')) return 'usd';
  return 'eur';
}

function UpgradeDialog({ ctx, onClose }: { ctx: UpgradeContext | null; onClose: () => void }) {
  const open = ctx !== null;
  const reason = ctx?.reason ?? 'pro';
  const copy = REASON_COPY[reason];
  const [currency, setCurrency] = React.useState<Currency>('eur');
  const [interval, setInterval] = React.useState<Interval>('year');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setCurrency(detectCurrency());
  }, [open]);

  const startUpgrade = () => {
    startTransition(async () => {
      try {
        await startDynamicCheckout({
          planSlug: 'pro',
          interval,
          currency,
        });
      } catch (err) {
        console.error('[upgrade-modal] checkout failed', err);
      }
    });
  };

  const price = PRICING[currency].pro[interval];
  const symbol = PRICING[currency].symbol;
  const yearlyMonthly = (PRICING[currency].pro.year / 12).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative"
        >
          <div className="from-primary/15 via-primary/5 absolute inset-0 -z-10 bg-gradient-to-br to-transparent" />
          <DialogHeader className="px-6 pb-2 pt-6">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Sparkles className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Notai Pro</span>
            </div>
            <DialogTitle className="font-serif text-2xl leading-tight tracking-tight">
              {copy.headline}
            </DialogTitle>
            <p className="text-muted-foreground text-sm">{copy.subline}</p>
            {typeof ctx?.used === 'number' && typeof ctx?.limit === 'number' ? (
              <p className="text-muted-foreground/70 text-xs">
                Used {ctx.used} / {ctx.limit}.
              </p>
            ) : null}
          </DialogHeader>

          <ul className="grid grid-cols-1 gap-1.5 px-6 pb-4 text-sm">
            {PRO_BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="bg-card/60 space-y-4 border-t px-6 py-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <CurrencyToggle value={currency} onChange={setCurrency} />
              <IntervalToggle value={interval} onChange={setInterval} />
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="font-serif text-3xl font-semibold tabular-nums">
                  {symbol}
                  {price}
                </div>
                <div className="text-muted-foreground text-xs">
                  {interval === 'year'
                    ? `≈ ${symbol}${yearlyMonthly}/mo · billed yearly · save 17%`
                    : 'per month, billed monthly'}
                </div>
              </div>
              <Button
                size="lg"
                onClick={startUpgrade}
                disabled={pending}
                className="shadow-primary/20 shadow-lg"
              >
                {pending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="mr-1 size-4" />
                )}
                Start 14-day trial
              </Button>
            </div>
            <p className="text-muted-foreground text-center text-[11px]">
              No card required for the trial. Cancel anytime from settings.
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (v: Currency) => void }) {
  const opts: Currency[] = ['eur', 'usd', 'ron'];
  return (
    <div className="bg-muted/60 flex rounded-full p-0.5 text-[11px] font-medium uppercase">
      {opts.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`rounded-full px-2.5 py-1 transition ${
            value === c ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  return (
    <div className="bg-muted/60 flex rounded-full p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange('month')}
        className={`rounded-full px-3 py-1 transition ${
          value === 'month' ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('year')}
        className={`rounded-full px-3 py-1 transition ${
          value === 'year' ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Yearly · 17% off
      </button>
    </div>
  );
}
