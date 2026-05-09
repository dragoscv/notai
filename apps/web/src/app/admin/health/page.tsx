import { CheckCircle2, XCircle, Database, CreditCard, Clock } from 'lucide-react';
import { getSystemHealth } from '@/server/actions/admin';
import { PageHeader, Section } from '../_components/primitives';

export const metadata = { title: 'Admin · Health' };

// Always fresh — never cache.
export const dynamic = 'force-dynamic';

function StatusRow({
  ok,
  label,
  detail,
  icon: Icon,
}: {
  ok: boolean;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div
        className={
          ok
            ? 'flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500'
            : 'flex size-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-500'
        }
      >
        <Icon className="size-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-muted-foreground text-xs">{detail}</div>
      </div>
      {ok ? (
        <CheckCircle2 className="size-5 text-emerald-500" />
      ) : (
        <XCircle className="size-5 text-rose-500" />
      )}
    </div>
  );
}

export default async function AdminHealthPage() {
  const h = await getSystemHealth();
  return (
    <>
      <PageHeader
        title="System health"
        description="Live checks against critical dependencies."
        actions={
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" />
            checked {h.serverAt.toLocaleTimeString()}
          </span>
        }
      />
      <Section>
        <div className="divide-y">
          <StatusRow
            ok={h.db.ok}
            label="PostgreSQL"
            detail={h.db.ok ? `Healthy · ${h.db.latencyMs}ms` : 'Cannot connect'}
            icon={Database}
          />
          <StatusRow
            ok={h.stripe.configured ? h.stripe.ok : true}
            label="Stripe"
            detail={
              !h.stripe.configured
                ? 'Not configured (STRIPE_SECRET_KEY missing)'
                : h.stripe.ok
                  ? `Reachable · ${h.stripe.latencyMs}ms`
                  : 'API call failed'
            }
            icon={CreditCard}
          />
        </div>
      </Section>
    </>
  );
}
