import Link from 'next/link';
import { Clock } from 'lucide-react';
import { listRecentlyOpened } from '@/server/actions/recent';

export async function ContinueCard() {
  const rows = await listRecentlyOpened(5);
  if (rows.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <Clock className="text-primary size-4" />
        <h3 className="text-sm font-semibold">Continue where you left off</h3>
      </div>
      <ul className="mt-3 grid gap-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/app/n/${r.id}`}
              className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition"
            >
              <span className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-md text-xs">
                {r.icon ?? '📝'}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.title || 'Untitled'}</span>
              <time className="text-muted-foreground text-[11px]">{timeAgo(r.lastOpenedAt)}</time>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
