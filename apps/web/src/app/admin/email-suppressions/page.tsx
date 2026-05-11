import { listSuppressions } from '@/server/actions/admin-suppressions';
import { PageHeader, Section } from '../_components/primitives';
import { SuppressionTable } from './suppression-table';

export const metadata = { title: 'Admin · Email suppressions' };
export const dynamic = 'force-dynamic';

export default async function AdminSuppressionsPage() {
  const rows = await listSuppressions(500);
  return (
    <>
      <PageHeader
        title="Email suppressions"
        description="Recipients we will not send to. Populated by Resend bounce/complaint webhooks and the unsubscribe page."
      />
      <Section
        title={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`}
        description="Showing the 500 most recent."
      >
        <SuppressionTable
          initial={rows.map((r) => ({
            email: r.email,
            reason: r.reason,
            source: r.source,
            detail: r.detail,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      </Section>
    </>
  );
}
