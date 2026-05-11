'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { adminAddSuppression, adminRemoveSuppression } from '@/server/actions/admin-suppressions';

export interface SuppressionRow {
  email: string;
  reason: string;
  source: string | null;
  detail: string | null;
  createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  bounce: 'Hard bounce',
  complaint: 'Spam complaint',
  manual: 'Manual',
  delivery_delayed: 'Delayed',
};

export function SuppressionTable({ initial }: { initial: SuppressionRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();

  const visible = filter
    ? rows.filter((r) => r.email.toLowerCase().includes(filter.toLowerCase()))
    : rows;

  function add() {
    const v = draft.trim();
    if (!v) return;
    startTransition(async () => {
      const res = await adminAddSuppression(v);
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add');
        return;
      }
      toast.success(`Suppressed ${v}`);
      setDraft('');
      // optimistic prepend; real value reloads on next nav
      setRows((rs) => [
        {
          email: v.toLowerCase(),
          reason: 'manual',
          source: 'admin',
          detail: 'added by admin',
          createdAt: new Date().toISOString(),
        },
        ...rs.filter((r) => r.email !== v.toLowerCase()),
      ]);
    });
  }

  function remove(email: string) {
    if (!confirm(`Remove ${email} from the suppression list?`)) return;
    startTransition(async () => {
      const res = await adminRemoveSuppression(email);
      if (!res.ok) {
        toast.error(res.error ?? 'Could not remove');
        return;
      }
      toast.success('Removed');
      setRows((rs) => rs.filter((r) => r.email !== email));
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <input
          type="search"
          placeholder="Filter by email…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-background min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-sm"
        />
        <input
          type="email"
          placeholder="Add address…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="bg-background w-64 rounded-md border px-2.5 py-1.5 text-sm"
        />
        <Button onClick={add} disabled={pending || !draft.trim()} size="sm">
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">No entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground bg-muted/30 text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-left font-medium">Detail</th>
                <th className="px-4 py-2 text-left font-medium">Added</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => (
                <tr key={r.email} className="hover:bg-muted/20">
                  <td className="truncate px-4 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-4 py-2">
                    <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">{r.source ?? '—'}</td>
                  <td className="text-muted-foreground max-w-[18rem] truncate px-4 py-2 text-xs">
                    {r.detail ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(r.email)}
                      disabled={pending}
                      aria-label={`Remove ${r.email}`}
                      className="text-muted-foreground hover:text-destructive rounded p-1"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
