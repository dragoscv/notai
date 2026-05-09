import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/layout/legal-page';
import { SupportForm } from '@/components/support/support-form';
import { LEGAL } from '@/lib/legal-info';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Notai team — support, billing, privacy, or partnership questions.',
  alternates: { canonical: '/contact' },
  robots: { index: true, follow: true },
};

export default async function ContactPage() {
  const session = await auth();
  return (
    <LegalPage
      title="Contact"
      subtitle="A real person reads every message. We aim to reply within two working days."
      updated={LEGAL.lastUpdated}
    >
      <h2>Send us a message</h2>
      <p>
        Submitting this form opens a support ticket. You&rsquo;ll receive a reference number and
        replies by email; if you&rsquo;re signed in you can also follow the conversation in your
        account at <Link href="/support">Support</Link>.
      </p>
      <SupportForm
        defaultName={session?.user?.name ?? undefined}
        defaultEmail={session?.user?.email ?? undefined}
      />

      <h2>Email directly</h2>
      <ul>
        <li>
          <strong>Support</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>
        </li>
        <li>
          <strong>Billing</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a>
        </li>
        <li>
          <strong>Privacy &amp; data requests</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>
        </li>
        <li>
          <strong>Data Protection Officer</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.dpo}`}>{LEGAL.emails.dpo}</a>
        </li>
        <li>
          <strong>Abuse / security</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.abuse}`}>{LEGAL.emails.abuse}</a>
        </li>
        <li>
          <strong>Legal</strong> · <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>
        </li>
      </ul>

      <h2>Operator</h2>
      <p>
        {LEGAL.brand} is operated by <strong>{LEGAL.operatorLegalName}</strong> (
        {LEGAL.operatorForm}), established in {LEGAL.countryName}. For an invoicing address or other
        legal request, email <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>.
      </p>

      <h2>Out of office</h2>
      <p>
        We do our best to reply within two working days (Monday–Friday, EET / EEST). Tickets marked{' '}
        <em>urgent</em> are looked at first.
      </p>
    </LegalPage>
  );
}
