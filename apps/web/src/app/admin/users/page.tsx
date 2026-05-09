import Link from 'next/link';
import { listAdminUsers } from '@/server/actions/admin';
import { PageHeader, Section, DataTable } from '../_components/primitives';
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@notai/ui';
import { UsersFilters } from './filters';

export const metadata = { title: 'Admin · Users' };

interface SearchParams {
  q?: string;
  tier?: string;
  status?: string;
  page?: string;
}

const PAGE_SIZE = 25;

function formatDate(d: Date | null): string {
  if (!d) return '—';
  const days = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  if (days < 1) return `${Math.round(days * 24)}h ago`;
  if (days < 30) return `${Math.round(days)}d ago`;
  return d.toLocaleDateString();
}

function tierBadge(tier: string) {
  if (tier === 'pro')
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      >
        Pro
      </Badge>
    );
  if (tier === 'teams')
    return (
      <Badge
        variant="outline"
        className="border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400"
      >
        Teams
      </Badge>
    );
  return <Badge variant="secondary">Free</Badge>;
}

function statusBadge(status: string) {
  if (status === 'active')
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
      >
        Active
      </Badge>
    );
  if (status === 'suspended')
    return (
      <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400">
        Suspended
      </Badge>
    );
  return <Badge variant="outline">{status}</Badge>;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const { rows, total } = await listAdminUsers({
    search: sp.q,
    tier: (sp.tier as 'all' | 'free' | 'pro' | 'teams' | undefined) ?? 'all',
    status: (sp.status as 'all' | 'active' | 'suspended' | 'deleted' | undefined) ?? 'all',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Users"
        description={`${total.toLocaleString()} accounts across all plans.`}
      />

      <Section>
        <div className="border-b p-3">
          <UsersFilters
            initialQuery={sp.q ?? ''}
            initialTier={sp.tier ?? 'all'}
            initialStatus={sp.status ?? 'all'}
          />
        </div>
        <DataTable
          rows={rows}
          empty="No users match your filters."
          columns={[
            {
              key: 'user',
              label: 'User',
              render: (r) => (
                <Link
                  href={`/admin/users/${r.id}`}
                  className="hover:text-primary flex items-center gap-2.5 transition"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={r.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(r.name ?? r.email)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.name ?? r.email}</div>
                    <div className="text-muted-foreground truncate text-xs">{r.email}</div>
                  </div>
                </Link>
              ),
            },
            { key: 'tier', label: 'Plan', render: (r) => tierBadge(r.tier) },
            { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
            {
              key: 'roles',
              label: 'Roles',
              render: (r) =>
                r.roles.length === 0 ? (
                  <span className="text-muted-foreground text-xs">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.roles.map((role) => (
                      <Badge key={role} variant="outline" className="text-[10px]">
                        {role}
                      </Badge>
                    ))}
                  </div>
                ),
            },
            {
              key: 'notes',
              label: 'Notes',
              render: (r) => <span className="tabular-nums">{r.notesCount}</span>,
              className: 'text-right',
            },
            {
              key: 'lastSeen',
              label: 'Last seen',
              render: (r) => (
                <span className="text-muted-foreground text-xs">{formatDate(r.lastSeenAt)}</span>
              ),
            },
            {
              key: 'created',
              label: 'Joined',
              render: (r) => (
                <span className="text-muted-foreground text-xs">{formatDate(r.createdAt)}</span>
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
                href={{ pathname: '/admin/users', query: { ...sp, page: String(page - 1) } }}
                className="hover:text-foreground"
              >
                ← Prev
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={{ pathname: '/admin/users', query: { ...sp, page: String(page + 1) } }}
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
