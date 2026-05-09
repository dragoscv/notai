import type { Metadata } from 'next';
import { auth } from '@/auth';
import { LegalPage } from '@/components/layout/legal-page';
import { SupportForm } from '@/components/support/support-form';
import { LEGAL } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'Open a support ticket',
  alternates: { canonical: '/support/new' },
};

export default async function NewTicketPage() {
  const session = await auth();
  return (
    <LegalPage
      title="Open a ticket"
      subtitle="One form for everything — bugs, billing, feature requests, account help."
      updated={LEGAL.lastUpdated}
    >
      <p>
        We answer in the order we receive them. Most replies arrive in under 48 hours during the
        working week. If your account is at risk, mark the ticket urgent and we&rsquo;ll look at it
        first.
      </p>
      <SupportForm
        defaultName={session?.user?.name ?? undefined}
        defaultEmail={session?.user?.email ?? undefined}
      />
    </LegalPage>
  );
}
