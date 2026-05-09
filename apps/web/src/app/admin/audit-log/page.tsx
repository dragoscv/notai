import Link from 'next/link';
import { listAuditLog } from '@/server/actions/admin';
import { PageHeader, Section, DataTable } from '../_components/primitives';
import { Badge } from '@notai/ui';

export const metadata = { title: 'Admin · Audit log' };

const PAGE_SIZE = 50;

function timeAgo(d: Date) {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resourceType?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const rows = await listAuditLog({
    action: sp.action,
    resourceType: sp.resourceType,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of every privileged action performed in the admin panel."
      />
      <Section>
        <form className="flex flex-wrap items-center gap-2 border-b p-3">
          <input
            name="action"
            defaultValue={sp.action ?? ''}
            placeholder="Filter action (e.g. user.suspend)"
            className="border-input bg-background h-9 max-w-xs flex-1 rounded-md border px-3 text-sm"
          />
          <input
            name="resourceType"
            defaultValue={sp.resourceType ?? ''}
            placeholder="Resource type"
            className="border-input bg-background h-9 max-w-xs rounded-md border px-3 text-sm"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 text-sm"
          >
            Filter
          </button>
        </form>
        <DataTable
          rows={rows.map((r) => ({ ...r, id: r.id }))}
          empty="No audit entries yet."
          columns={[
            {
              key: 'when',
              label: 'When',
              render: (r) => (
                <span className="text-muted-foreground text-xs" title={r.createdAt.toISOString()}>
                  {timeAgo(r.createdAt)}
                </span>
              ),
            },
            {
              key: 'actor',
              label: 'Actor',
              render: (r) =>
                r.actorId ? (
                  <Link
                    href={`/admin/users/${r.actorId}`}
                    className="hover:text-primary text-xs transition"
                  >
                    {r.actorName ?? r.actorEmail ?? r.actorId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">system</span>
                ),
            },
            {
              key: 'action',
              label: 'Action',
              render: (r) => (
                <code className="bg-muted/50 rounded px-1.5 py-0.5 text-[11px]">{r.action}</code>
              ),
            },
            {
              key: 'resource',
              label: 'Resource',
              render: (r) =>
                r.resourceType ? (
                  <span className="text-xs">
                    <Badge variant="outline" className="mr-1.5 text-[10px]">
                      {r.resourceType}
                    </Badge>
                    {r.resourceId ? (
                      <span className="text-muted-foreground font-mono">
                        {r.resourceId.slice(0, 8)}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                ),
            },
            {
              key: 'detail',
              label: 'Detail',
              render: (r) => {
                const blob = r.metadata ?? r.after ?? null;
                if (!blob || Object.keys(blob as object).length === 0)
                  return <span className="text-muted-foreground text-xs">—</span>;
                return (
                  <details className="text-xs">
                    <summary className="hover:text-foreground text-muted-foreground cursor-pointer transition">
                      view
                    </summary>
                    <pre className="bg-muted/40 mt-1.5 overflow-x-auto rounded p-2 text-[10px]">
                      {JSON.stringify(blob, null, 2)}
                    </pre>
                  </details>
                );
              },
            },
          ]}
        />
        <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <span>Page {page}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={{ pathname: '/admin/audit-log', query: { ...sp, page: String(page - 1) } }}
                className="hover:text-foreground"
              >
                ← Prev
              </Link>
            ) : null}
            {rows.length === PAGE_SIZE ? (
              <Link
                href={{ pathname: '/admin/audit-log', query: { ...sp, page: String(page + 1) } }}
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
