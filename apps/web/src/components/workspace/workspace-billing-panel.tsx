'use client';

import * as React from 'react';
import { Button, Input } from '@notai/ui';
import { toast } from 'sonner';
import {
  startWorkspaceCheckout,
  openWorkspaceBillingPortal,
} from '@/server/actions/workspace-billing';

interface BillingData {
  sub: {
    tier: string;
    status: string;
    seats: number;
    interval: string | null;
    currency: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  seatInfo: {
    tier: string;
    status: string;
    seats: number | null;
    memberCount: number;
    seatsAvailable: number | null;
  };
}

export function WorkspaceBillingPanel({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: BillingData;
}) {
  const [seats, setSeats] = React.useState(Math.max(initial.seatInfo.memberCount, 3));
  const [interval, setInterval] = React.useState<'month' | 'year'>('month');
  const [currency, setCurrency] = React.useState<'eur' | 'usd' | 'ron'>('eur');
  const [busy, setBusy] = React.useState(false);

  const startCheckout = async () => {
    setBusy(true);
    try {
      await startWorkspaceCheckout({ workspaceId, seats, interval, currency });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('NEXT_REDIRECT')) return;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      await openWorkspaceBillingPortal(workspaceId);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('NEXT_REDIRECT')) return;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const hasActiveSub =
    initial.sub && initial.sub.tier !== 'free' && initial.sub.status === 'active';

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-lg border p-4">
        <h2 className="text-muted-foreground text-sm font-medium">Current</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            Plan: <span className="font-medium capitalize">{initial.seatInfo.tier}</span>
          </div>
          <div>
            Status: <span className="font-medium">{initial.seatInfo.status}</span>
          </div>
          <div>
            Seats: <span className="font-medium">{initial.seatInfo.seats ?? '∞'}</span>
          </div>
          <div>
            Members: <span className="font-medium">{initial.seatInfo.memberCount}</span>
          </div>
          {initial.sub?.currentPeriodEnd && (
            <div className="text-muted-foreground col-span-2">
              {initial.sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
              {new Date(initial.sub.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>
      </section>

      {hasActiveSub ? (
        <section className="bg-card space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Manage subscription</h2>
          <p className="text-muted-foreground text-sm">
            Change seats, switch billing cycle, or cancel from the Stripe portal.
          </p>
          <Button onClick={openPortal} disabled={busy}>
            Open billing portal
          </Button>
        </section>
      ) : (
        <section className="bg-card space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Upgrade to Teams</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Seats</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Cycle</label>
              <select
                className="bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={interval}
                onChange={(e) => setInterval(e.target.value as 'month' | 'year')}
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Currency</label>
              <select
                className="bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'eur' | 'usd' | 'ron')}
              >
                <option value="eur">EUR</option>
                <option value="usd">USD</option>
                <option value="ron">RON</option>
              </select>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            You have {initial.seatInfo.memberCount} member
            {initial.seatInfo.memberCount === 1 ? '' : 's'}. Buy at least that many seats.
          </p>
          <Button onClick={startCheckout} disabled={busy || seats < initial.seatInfo.memberCount}>
            Continue to checkout
          </Button>
        </section>
      )}
    </div>
  );
}
