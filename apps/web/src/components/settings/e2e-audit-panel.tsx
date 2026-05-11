'use client';
import * as React from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { listMyE2eAudit, type E2eAuditRow } from '@/server/actions/e2e-audit';

const EVENT_LABEL: Record<E2eAuditRow['event'], string> = {
  setup: 'Encryption set up',
  rotate: 'Passphrase rotated',
  note_lock: 'Note locked',
  note_unlock: 'Note unlocked',
  note_disable: 'Note unencrypted',
  recovery_unlock: 'Unlocked with recovery key',
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function E2eAuditPanel() {
  const [rows, setRows] = React.useState<E2eAuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMyE2eAudit());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4" /> Encryption activity
          </p>
          <p className="text-muted-foreground text-xs">
            The last 200 lock, unlock, and key-management events on your account. Recorded on the
            server so you can audit your own privacy posture.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {loading ? 'Loading…' : 'No encryption events yet.'}
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 border-b border-dashed py-1 last:border-0"
            >
              <span className="truncate">
                <span className="font-medium">{EVENT_LABEL[r.event] ?? r.event}</span>
                {r.noteId ? (
                  <span className="text-muted-foreground"> · note {r.noteId.slice(0, 8)}</span>
                ) : null}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatRelative(r.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
