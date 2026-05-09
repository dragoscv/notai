'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Ticket } from 'lucide-react';
import { Button, Input, Label, Badge } from '@notai/ui';
import { createCoupon, deleteCoupon } from '@/server/actions/admin';

interface Coupon {
  id: string;
  name: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: string;
  durationInMonths: number | null;
  valid: boolean;
  redeemBy: string | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
}

export function CouponsClient({ coupons: initial }: { coupons: Coupon[] }) {
  const [list, setList] = React.useState(initial);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [percent, setPercent] = React.useState('20');
  const [duration, setDuration] = React.useState<'once' | 'forever' | 'repeating'>('once');
  const [months, setMonths] = React.useState('3');
  const [pending, start] = React.useTransition();

  return (
    <div>
      <div className="flex items-center justify-between border-b p-4">
        <span className="text-muted-foreground text-xs">{list.length} coupon(s)</span>
        <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1.5 size-3.5" />
          New coupon
        </Button>
      </div>

      <AnimatePresence>
        {creating ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b"
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="LAUNCH20"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Percent off</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Duration</Label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as typeof duration)}
                  className="border-input bg-background mt-1.5 h-9 w-full rounded-md border px-2.5 text-sm"
                >
                  <option value="once">Once</option>
                  <option value="repeating">Repeating</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              {duration === 'repeating' ? (
                <div>
                  <Label>Months</Label>
                  <Input
                    type="number"
                    min="1"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              ) : null}
              <div className="flex gap-2 sm:col-span-2">
                <Button
                  size="sm"
                  disabled={pending || !name.trim() || !percent}
                  onClick={() =>
                    start(async () => {
                      try {
                        const id = await createCoupon({
                          name: name.trim(),
                          percentOff: parseFloat(percent),
                          duration,
                          durationInMonths:
                            duration === 'repeating' ? parseInt(months, 10) : undefined,
                        });
                        toast.success(`Coupon ${id} created`);
                        setName('');
                        setCreating(false);
                        // Add optimistically
                        setList((prev) => [
                          {
                            id,
                            name: name.trim(),
                            percentOff: parseFloat(percent),
                            amountOff: null,
                            currency: null,
                            duration,
                            durationInMonths:
                              duration === 'repeating' ? parseInt(months, 10) : null,
                            valid: true,
                            redeemBy: null,
                            timesRedeemed: 0,
                            maxRedemptions: null,
                          },
                          ...prev,
                        ]);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed');
                      }
                    })
                  }
                >
                  Create coupon
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="divide-y">
        {list.length === 0 && !creating ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-12 text-center text-sm">
            <Ticket className="size-8 opacity-30" />
            No coupons.
          </div>
        ) : (
          list.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-semibold">{c.id}</code>
                  <Badge variant="outline" className="text-[10px]">
                    {c.duration}
                    {c.durationInMonths ? ` · ${c.durationInMonths}mo` : ''}
                  </Badge>
                  {!c.valid ? (
                    <Badge variant="secondary" className="text-[10px]">
                      invalid
                    </Badge>
                  ) : null}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {c.percentOff
                    ? `${c.percentOff}% off`
                    : `${(c.amountOff ?? 0) / 100} ${c.currency?.toUpperCase()} off`}
                  {' · '}
                  Redeemed {c.timesRedeemed}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                </div>
              </div>
              <button
                className="text-muted-foreground transition hover:text-rose-500"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!confirm(`Delete coupon "${c.id}"?`)) return;
                    try {
                      await deleteCoupon(c.id);
                      setList((prev) => prev.filter((x) => x.id !== c.id));
                      toast.success('Deleted');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    }
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
