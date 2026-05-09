import Link from 'next/link';
import { listAdminTickets } from '@/server/actions/support';
import { PageHeader, Section, DataTable } from '../_components/primitives';
import { Badge } from '@notai/ui';
import { TicketsFilters } from './filters';

export const metadata = { title: 'Admin · Support' };

interface SearchParams {
  status?: string;
  q?: string;
  page?: string;
}

const PAGE_SIZE = 50;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'border-amber-500/30 text-amber-600 dark:text-amber-400' },
  pending: { label: 'Pending', cls: 'border-sky-500/30 text-sky-600 dark:text-sky-400' },
  resolved: {
    label: 'Resolved',
    cls: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  },
  closed: { label: 'Closed', cls: 'border-muted-foreground/30 text-muted-foreground' },
};

const FALLBACK_STATUS = {
  label: 'Unknown',
  cls: 'border-muted-foreground/30 text-muted-foreground',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'border-muted-foreground/30 text-muted-foreground',
  normal: 'border-sky-500/30 text-sky-600 dark:text-sky-400',
  high: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  urgent: 'border-rose-500/40 text-rose-700 dark:text-rose-400',
};

function fmt(d: Date | null): string {
  if (!d) return '—';
  const days = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  if (days < 1) return `${Math.round(days * 24)}h ago`;
  if (days < 30) return `${Math.round(days)}d ago`;
  return d.toLocaleDateString();
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const status =
    (sp.status as 'all' | 'open' | 'pending' | 'resolved' | 'closed' | undefined) ?? 'open';

  const { rows, total } = await listAdminTickets({
    status,
    q: sp.q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Support"
        description={`${total.toLocaleString()} ticket${total === 1 ? '' : 's'} matching the current filter.`}
      />

      <Section>
        <div className="border-b p-3">
          <TicketsFilters initialStatus={status} initialQuery={sp.q ?? ''} />
        </div>
        <DataTable
          rows={rows}
          empty="No tickets match your filters."
          columns={[
            {
              key: 'reference',
              label: 'Ref',
              render: (r) => (
                <Link href={`/admin/support/${r.id}`} className="hover:text-primary transition">
                  <code className="text-[11px]">{r.reference}</code>
                </Link>
              ),
            },
            {
              key: 'subject',
              label: 'Subject',
              render: (r) => (
                <Link
                  href={`/admin/support/${r.id}`}
                  className="hover:text-primary block min-w-0 transition"
                >
                  <div className="truncate font-medium">{r.subject}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {r.name} · {r.email}
                  </div>
                </Link>
              ),
            },
            {
              key: 'category',
              label: 'Category',
              render: (r) => (
                <Badge variant="outline" className="text-[10px]">
                  {r.category}
                </Badge>
              ),
            },
            {
              key: 'priority',
              label: 'Priority',
              render: (r) => (
                <Badge
                  variant="outline"
                  className={'text-[10px] ' + (PRIORITY_BADGE[r.priority] ?? '')}
                >
                  {r.priority}
                </Badge>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => {
                const s = STATUS_BADGE[r.status] ?? FALLBACK_STATUS;
                return (
                  <Badge variant="outline" className={s.cls}>
                    {s.label}
                  </Badge>
                );
              },
            },
            {
              key: 'updated',
              label: 'Updated',
              render: (r) => (
                <span className="text-muted-foreground text-xs">{fmt(r.updatedAt)}</span>
              ),
            },
          ]}
        />
        <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <span>
            Page {page} of {totalPages} · {rows.length} of {total} shown
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={{ pathname: '/admin/support', query: { ...sp, page: String(page - 1) } }}
                className="hover:text-foreground"
              >
                ← Prev
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={{ pathname: '/admin/support', query: { ...sp, page: String(page + 1) } }}
                className="hover:text-foreground"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </Section>
    </>
  );
}
