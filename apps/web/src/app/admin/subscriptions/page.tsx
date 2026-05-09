import Link from 'next/link';
import { listAdminSubscriptions } from '@/server/actions/admin';
import { PageHeader, Section, DataTable } from '../_components/primitives';
import { Badge } from '@notai/ui';
import { SubscriptionRowActions } from './actions';

export const metadata = { title: 'Admin · Subscriptions' };

const PAGE_SIZE = 25;
const STATUSES = ['all', 'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid'];
const TIERS = ['all', 'free', 'pro', 'teams'];

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tier?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const { rows, total } = await listAdminSubscriptions({
    search: sp.q,
    status: sp.status ?? 'all',
    tier: sp.tier ?? 'all',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description={`${total.toLocaleString()} total subscriptions across all users.`}
      />
      <Section>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <form className="flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Search email…"
              className="border-input bg-background h-9 max-w-xs flex-1 rounded-md border px-3 text-sm"
            />
            <select
              name="status"
              defaultValue={sp.status ?? 'all'}
              className="border-input bg-background h-9 rounded-md border px-2.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? 'Any status' : s}
                </option>
              ))}
            </select>
            <select
              name="tier"
              defaultValue={sp.tier ?? 'all'}
              className="border-input bg-background h-9 rounded-md border px-2.5 text-sm"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'Any tier' : t}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 text-sm"
            >
              Apply
            </button>
          </form>
        </div>
        <DataTable
          rows={rows.map((r, i) => ({ ...r, id: `${r.userId}-${i}` }))}
          empty="No subscriptions match."
          columns={[
            {
              key: 'user',
              label: 'User',
              render: (r) => (
                <Link href={`/admin/users/${r.userId}`} className="hover:text-primary transition">
                  <div className="font-medium">{r.name ?? r.email}</div>
                  <div className="text-muted-foreground text-xs">{r.email}</div>
                </Link>
              ),
            },
            {
              key: 'tier',
              label: 'Tier',
              render: (r) => <Badge variant="outline">{r.tier}</Badge>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => {
                const color =
                  r.status === 'active'
                    ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : r.status === 'trialing'
                      ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : r.status === 'past_due'
                        ? 'border-rose-500/30 text-rose-600 dark:text-rose-400'
                        : '';
                return (
                  <Badge variant="outline" className={color}>
                    {r.status}
                  </Badge>
                );
              },
            },
            {
              key: 'cycle',
              label: 'Cycle',
              render: (r) => (
                <span className="text-xs">
                  {r.interval ?? '—'} · {r.currency?.toUpperCase() ?? '—'}
                </span>
              ),
            },
            {
              key: 'periodEnd',
              label: 'Period end',
              render: (r) => (
                <span className="text-muted-foreground text-xs">
                  {r.currentPeriodEnd?.toLocaleDateString() ?? '—'}
                </span>
              ),
            },
            {
              key: 'comp',
              label: 'Comp',
              render: (r) =>
                r.compReason ? (
                  <span className="text-xs italic" title={r.compReason}>
                    yes
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                ),
            },
            {
              key: 'actions',
              label: '',
              render: (r) => <SubscriptionRowActions userId={r.userId} email={r.email} />,
            },
          ]}
        />
        <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={{
                  pathname: '/admin/subscriptions',
                  query: { ...sp, page: String(page - 1) },
                }}
                className="hover:text-foreground"
              >
                ← Prev
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={{
                  pathname: '/admin/subscriptions',
                  query: { ...sp, page: String(page + 1) },
                }}
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
