import { getApiStatus } from '@/server/actions/api-status';
import type { Metadata } from 'next';
import { resolveLocale } from '../../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Status API Notai' : 'Notai API status',
    description: isRo
      ? 'Indicatori publici de stare și latență pentru API-ul REST Notai. Actualizat la fiecare 60 de secunde.'
      : 'Public health and latency metrics for the Notai REST API. Updated every 60 seconds.',
  };
}
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ApiStatusPage() {
  const [s, locale] = await Promise.all([getApiStatus(), resolveLocale()]);
  const isRo = locale === 'ro';
  const errorRate = s.total24h > 0 ? s.errors24h / s.total24h : 0;
  const ok = errorRate < 0.01;
  const maxDay = Math.max(1, ...s.daily.map((d) => d.total));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{isRo ? 'Status API' : 'API status'}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isRo ? (
              <>
                Indicatori în direct pentru <code className="bg-muted rounded px-1">/api/v1/*</code>{' '}
                din ultimele 24 de ore. Actualizat la fiecare 60 de secunde.
              </>
            ) : (
              <>
                Live metrics for <code className="bg-muted rounded px-1">/api/v1/*</code> over the
                last 24 hours. Updated every 60 seconds.
              </>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            ok
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
          }`}
        >
          {ok
            ? isRo
              ? 'Toate sistemele funcționează normal'
              : 'All systems normal'
            : isRo
              ? 'Rată de erori crescută'
              : 'Elevated error rate'}
        </span>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label={isRo ? 'Cereri (24h)' : 'Requests (24h)'}
          value={s.total24h.toLocaleString()}
        />
        <Stat
          label={isRo ? 'Rată de erori' : 'Error rate'}
          value={`${(errorRate * 100).toFixed(2)}%`}
          muted={ok}
        />
        <Stat label={isRo ? 'Latență medie' : 'Avg latency'} value={`${s.avgLatencyMs} ms`} />
        <Stat label={isRo ? 'Latență p95' : 'p95 latency'} value={`${s.p95LatencyMs} ms`} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">{isRo ? 'Ultimele 7 zile' : 'Last 7 days'}</h2>
        {s.daily.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isRo ? 'Încă nu există trafic.' : 'No traffic yet.'}
          </p>
        ) : (
          <div className="bg-card rounded-2xl border p-4">
            <div className="flex h-32 items-end gap-2">
              {s.daily.map((d) => {
                const h = (d.total / maxDay) * 100;
                const errH = d.total > 0 ? (d.errors / d.total) * h : 0;
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex h-full w-full items-end">
                      <div
                        className="bg-primary/30 hover:bg-primary/50 w-full rounded-t transition-colors"
                        style={{ height: `${h}%` }}
                        title={
                          isRo
                            ? `${d.total} cereri · ${d.errors} erori`
                            : `${d.total} requests · ${d.errors} errors`
                        }
                      />
                      {errH > 0 && (
                        <div
                          className="absolute bottom-0 w-full rounded-t bg-red-500/60"
                          style={{ height: `${errH}%` }}
                        />
                      )}
                    </div>
                    <span className="text-muted-foreground text-[10px]">{d.day.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">
          {isRo ? 'Cele mai accesate rute (24h)' : 'Top routes (24h)'}
        </h2>
        {s.routes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isRo ? 'Încă nu există trafic.' : 'No traffic yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{isRo ? 'Metodă' : 'Method'}</th>
                  <th className="px-3 py-2 font-medium">{isRo ? 'Cale' : 'Path'}</th>
                  <th className="px-3 py-2 text-right font-medium">{isRo ? 'Apeluri' : 'Calls'}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {isRo ? 'Rată erori' : 'Error rate'}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {isRo ? 'ms medii' : 'Avg ms'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.routes.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.method}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.path}</td>
                    <td className="px-3 py-2 text-right">{r.count.toLocaleString()}</td>
                    <td
                      className={`px-3 py-2 text-right ${
                        r.errorRate > 0.05 ? 'text-red-600 dark:text-red-400' : ''
                      }`}
                    >
                      {(r.errorRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right">{r.avgMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {s.throttled24h > 0 && (
        <p className="text-muted-foreground text-xs">
          {isRo ? (
            <>
              {s.throttled24h.toLocaleString()}{' '}
              {s.throttled24h === 1 ? 'cerere a fost' : 'cereri au fost'} limitate (HTTP 429) în
              ultimele 24h. Vezi antetele de rate-limit din referința API pentru tratarea în client.
            </>
          ) : (
            <>
              {s.throttled24h.toLocaleString()} request{s.throttled24h === 1 ? '' : 's'} were
              throttled (HTTP 429) in the last 24h. See the rate-limit headers in the API reference
              for client handling.
            </>
          )}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          muted ? 'text-muted-foreground' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
