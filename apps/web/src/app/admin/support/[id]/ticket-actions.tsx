'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { updateAdminTicket } from '@/server/actions/support';

const STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export function TicketActions({
  ticketId,
  status,
  priority,
}: {
  ticketId: string;
  status: string;
  priority: string;
}) {
  const [pending, start] = React.useTransition();

  function update(patch: { status?: string; priority?: string }) {
    start(async () => {
      try {
        await updateAdminTicket({
          ticketId,
          status: patch.status as (typeof STATUSES)[number] | undefined,
          priority: patch.priority as (typeof PRIORITIES)[number] | undefined,
        });
        toast.success('Updated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      }
    });
  }

  return (
    <div className="space-y-3">
      <Field label="Status">
        <select
          disabled={pending}
          value={status}
          onChange={(e) => update({ status: e.target.value })}
          className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <select
          disabled={pending}
          value={priority}
          onChange={(e) => update({ priority: e.target.value })}
          className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
