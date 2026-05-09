import { db, eq, sql, count, gte, isNotNull, and, users, notes, subscriptions } from '@notai/db';
import { requirePermission } from '@/server/rbac';
import { PageHeader, Section, StatCard } from '../_components/primitives';

export const metadata = { title: 'Admin · Analytics' };

const SQL_TIMESERIES = sql`
  SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*)::int AS value
  FROM users
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
  ORDER BY 1
`;

const SQL_NOTES_BY_DAY = sql`
  SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*)::int AS value
  FROM notes
  WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
  ORDER BY 1
`;

interface SeriesPoint {
  day: string;
  value: number;
}

function MiniSpark({ data, label, total }: { data: SeriesPoint[]; label: string; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bg-card/60 rounded-2xl border p-5">
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-2 font-serif text-3xl font-semibold tabular-nums">
        {total.toLocaleString()}
      </div>
      <div className="text-muted-foreground/70 mb-3 text-xs">last 30 days</div>
      <div className="flex h-16 items-end gap-0.5">
        {data.length === 0 ? (
          <div className="text-muted-foreground self-center text-xs">No data</div>
        ) : (
          data.map((d) => (
            <div
              key={d.day}
              className="from-primary/40 to-primary/80 flex-1 rounded-sm bg-gradient-to-t transition hover:opacity-100"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, opacity: 0.6 }}
              title={`${d.day}: ${d.value}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  await requirePermission('platform:analytics');

  // eslint-disable-next-line react-hooks/purity
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [usersSeries, notesSeries] = await Promise.all([
    db.execute(SQL_TIMESERIES) as unknown as Promise<SeriesPoint[]>,
    db.execute(SQL_NOTES_BY_DAY) as unknown as Promise<SeriesPoint[]>,
  ]);

  const usersSeriesArr = (Array.isArray(usersSeries) ? usersSeries : []).map((p) => ({
    day: typeof p.day === 'string' ? p.day : new Date(p.day).toISOString().slice(0, 10),
    value: Number(p.value),
  }));
  const notesSeriesArr = (Array.isArray(notesSeries) ? notesSeries : []).map((p) => ({
    day: typeof p.day === 'string' ? p.day : new Date(p.day).toISOString().slice(0, 10),
    value: Number(p.value),
  }));

  const signups30 =
    (await db.select({ value: count() }).from(users).where(gte(users.createdAt, since30)))[0]
      ?.value ?? 0;
  const notes30 =
    (
      await db
        .select({ value: count() })
        .from(notes)
        .where(and(gte(notes.createdAt, since30)))
    )[0]?.value ?? 0;

  const trialingRow = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'trialing'));
  const activePaidRow = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'));
  const trialing = trialingRow[0]?.value ?? 0;
  const activePaid = activePaidRow[0]?.value ?? 0;

  const tierRows = await db
    .select({ tier: subscriptions.tier, value: count() })
    .from(subscriptions)
    .groupBy(subscriptions.tier);

  // Top users by note count
  const topUsers = await db
    .select({
      userId: notes.ownerId,
      email: users.email,
      name: users.name,
      value: count(),
    })
    .from(notes)
    .innerJoin(users, eq(users.id, notes.ownerId))
    .where(isNotNull(users.email))
    .groupBy(notes.ownerId, users.email, users.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return (
    <>
      <PageHeader title="Analytics" description="Platform growth, engagement, and conversion." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <MiniSpark data={usersSeriesArr} label="Signups" total={signups30} />
        <MiniSpark data={notesSeriesArr} label="Notes created" total={notes30} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Trialing" value={trialing.toLocaleString()} index={0} />
        <StatCard label="Active paid" value={activePaid.toLocaleString()} index={1} />
        <StatCard
          label="Plan mix"
          value={`${tierRows.length}`}
          hint={tierRows.map((r) => `${r.tier}: ${r.value}`).join(' · ')}
          index={2}
        />
      </div>

      <Section title="Top users by note count" description="Last 10 most active note creators.">
        <div className="divide-y">
          {topUsers.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-sm">No data yet.</div>
          ) : (
            topUsers.map((u, i) => (
              <div key={u.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground w-6 tabular-nums">#{i + 1}</span>
                <div className="flex-1 truncate">
                  <div className="font-medium">{u.name ?? u.email}</div>
                  <div className="text-muted-foreground text-xs">{u.email}</div>
                </div>
                <div className="font-serif tabular-nums">{u.value}</div>
              </div>
            ))
          )}
        </div>
      </Section>
    </>
  );
}
