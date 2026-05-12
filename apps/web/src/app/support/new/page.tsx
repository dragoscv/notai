import type { Metadata } from 'next';
import { auth } from '@/auth';
import { LegalPage } from '@/components/layout/legal-page';
import { SupportForm } from '@/components/support/support-form';
import { LEGAL } from '@/lib/legal-info';
import { resolveLocale } from '../../../../i18n';

export const metadata: Metadata = {
  title: 'Open a support ticket',
  alternates: { canonical: '/support/new' },
};

export default async function NewTicketPage() {
  const [session, locale] = await Promise.all([auth(), resolveLocale()]);
  const isRo = locale === 'ro';
  return (
    <LegalPage
      title={isRo ? 'Deschide un tichet' : 'Open a ticket'}
      subtitle={
        isRo
          ? 'Un singur formular pentru orice — buguri, facturare, cereri de funcționalități, ajutor cu contul.'
          : 'One form for everything — bugs, billing, feature requests, account help.'
      }
      updated={LEGAL.lastUpdated}
    >
      <p>
        {isRo
          ? 'Răspundem în ordinea în care primim mesajele. Cele mai multe răspunsuri ajung în mai puțin de 48 de ore în săptămâna de lucru. Dacă contul tău este în pericol, marchează tichetul ca urgent și ne uităm la el primul.'
          : 'We answer in the order we receive them. Most replies arrive in under 48 hours during the working week. If your account is at risk, mark the ticket urgent and we\u2019ll look at it first.'}
      </p>
      <SupportForm
        defaultName={session?.user?.name ?? undefined}
        defaultEmail={session?.user?.email ?? undefined}
      />
    </LegalPage>
  );
}
