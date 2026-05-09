import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAdminUser } from '@/server/actions/admin';
import { PageHeader, Section, StatCard } from '../../_components/primitives';
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@notai/ui';
import { UserActions } from './actions';

export const metadata = { title: 'Admin · User detail' };

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getAdminUser(id);
  } catch {
    notFound();
  }
  const { user, subscription, roles, notesCount, attachmentBytes } = data;

  return (
    <>
      <Link
        href="/admin/users"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1.5 text-xs font-medium transition"
      >
        <ArrowLeft className="size-3.5" />
        Back to users
      </Link>

      <PageHeader title={user.name ?? user.email} description={user.email} />

      <div className="mb-6 flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback>{(user.name ?? user.email)[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              user.status === 'active'
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : user.status === 'suspended'
                  ? 'border-rose-500/30 text-rose-600 dark:text-rose-400'
                  : ''
            }
          >
            {user.status}
          </Badge>
          {roles.map((r) => (
            <Badge key={r} variant="secondary">
              {r}
            </Badge>
          ))}
          <span className="text-muted-foreground text-xs">
            Joined {user.createdAt.toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Notes" value={notesCount.toLocaleString()} index={0} />
        <StatCard label="Storage" value={fmtBytes(attachmentBytes)} index={1} />
        <StatCard
          label="Plan"
          value={subscription?.tier ?? 'free'}
          hint={subscription?.status ?? 'no subscription'}
          index={2}
        />
      </div>

      {subscription ? (
        <Section title="Subscription">
          <dl className="grid gap-3 p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Tier</dt>
              <dd className="mt-0.5 font-medium">{subscription.tier}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Status</dt>
              <dd className="mt-0.5 font-medium">{subscription.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Interval</dt>
              <dd className="mt-0.5 font-medium">{subscription.interval ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Currency</dt>
              <dd className="mt-0.5 font-medium uppercase">{subscription.currency ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">
                Period ends
              </dt>
              <dd className="mt-0.5 font-medium">
                {subscription.currentPeriodEnd?.toLocaleDateString() ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Trial ends</dt>
              <dd className="mt-0.5 font-medium">
                {subscription.trialEndsAt?.toLocaleDateString() ?? '—'}
              </dd>
            </div>
            {subscription.compReason ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs uppercase tracking-wider">
                  Comped reason
                </dt>
                <dd className="mt-0.5 font-medium">{subscription.compReason}</dd>
              </div>
            ) : null}
          </dl>
        </Section>
      ) : null}

      <UserActions userId={user.id} status={user.status} currentRoles={roles as string[]} />
    </>
  );
}
