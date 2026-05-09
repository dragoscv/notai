import { getOverviewMetrics } from '@/server/actions/admin';
import { PageHeader, StatCard, Section } from './_components/primitives';

export const metadata = { title: 'Admin · Overview' };

const CURRENCY_SYMBOL: Record<string, string> = { eur: '€', usd: '$', ron: 'RON ' };

function formatMoney(minorUnits: number, currency: string) {
  const major = minorUnits / 100;
  return `${CURRENCY_SYMBOL[currency] ?? ''}${major.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function AdminOverviewPage() {
  const m = await getOverviewMetrics();
  const mrrEntries = Object.entries(m.mrrByCurrency);
  return (
    <>
      <PageHeader
        title="Overview"
        description="Health of the platform at a glance — usage, revenue, and recent activity."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={m.totalUsers.toLocaleString()} index={0} />
        <StatCard
          label="Pro / Teams"
          value={m.proUsers.toLocaleString()}
          hint={`${m.freeUsers.toLocaleString()} on free`}
          index={1}
        />
        <StatCard label="Notes (live)" value={m.totalNotes.toLocaleString()} index={2} />
        <StatCard
          label="New users · 30d"
          value={`+${m.newUsers30}`}
          hint="Last 30 days"
          index={3}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="DAU" value={m.dau.toLocaleString()} hint="Active in 24h" index={4} />
        <StatCard label="WAU" value={m.wau.toLocaleString()} hint="Active in 7d" index={5} />
        <StatCard label="MAU" value={m.mau.toLocaleString()} hint="Active in 30d" index={6} />
      </div>

      <Section
        title="Recurring revenue"
        description="Monthly recurring across active subscriptions, by currency."
      >
        {mrrEntries.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            No active paid subscriptions yet.
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {mrrEntries.map(([currency, mrr]) => (
              <div key={currency} className="rounded-xl border p-4">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">
                  MRR · {currency.toUpperCase()}
                </div>
                <div className="mt-1.5 font-serif text-2xl font-semibold tabular-nums">
                  {formatMoney(mrr, currency)}
                </div>
                <div className="text-muted-foreground/70 text-xs">
                  ARR ≈ {formatMoney(mrr * 12, currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
