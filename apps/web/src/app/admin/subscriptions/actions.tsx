'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@notai/ui';
import { compSubscription, refundLatestPayment } from '@/server/actions/admin';

export function SubscriptionRowActions({ userId, email }: { userId: string; email: string }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <CompDialog userId={userId} email={email} />
      <RefundDialog userId={userId} email={email} />
    </div>
  );
}

function CompDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = React.useState(false);
  const [planSlug, setPlanSlug] = React.useState<'pro' | 'teams'>('pro');
  const [reason, setReason] = React.useState('');
  const [days, setDays] = React.useState('30');
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-xs">
          Comp
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comp subscription</DialogTitle>
          <DialogDescription>
            Grant {email} a free Pro/Teams subscription. No charge through Stripe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Plan</Label>
            <select
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value as 'pro' | 'teams')}
              className="border-input bg-background mt-1.5 h-9 w-full rounded-md border px-2.5 text-sm"
            >
              <option value="pro">Pro</option>
              <option value="teams">Teams</option>
            </select>
          </div>
          <div>
            <Label>Duration (days, blank = perpetual)</Label>
            <Input value={days} onChange={(e) => setDays(e.target.value)} placeholder="30" />
          </div>
          <div>
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VIP, beta tester, customer support…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !reason.trim()}
            onClick={() =>
              start(async () => {
                try {
                  await compSubscription({
                    userId,
                    planSlug,
                    reason: reason.trim(),
                    durationDays: days ? parseInt(days, 10) : undefined,
                  });
                  toast.success('Comp granted');
                  setOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed');
                }
              })
            }
          >
            Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-xs">
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund last payment</DialogTitle>
          <DialogDescription>
            Refund the most recent Stripe charge for {email}. This is irreversible.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Reason (audit log)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || !reason.trim()}
            onClick={() =>
              start(async () => {
                try {
                  await refundLatestPayment({ userId, reason: reason.trim() });
                  toast.success('Refund issued');
                  setOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed');
                }
              })
            }
          >
            Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
