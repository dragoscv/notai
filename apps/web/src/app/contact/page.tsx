import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/layout/legal-page';
import { SupportForm } from '@/components/support/support-form';
import { LEGAL } from '@/lib/legal-info';
import { auth } from '@/auth';
import { resolveLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: 'Contact',
    description: isRo
      ? 'Ia legătura cu echipa Notai — suport, facturare, confidențialitate sau parteneriate.'
      : 'Get in touch with the Notai team — support, billing, privacy, or partnership questions.',
    alternates: { canonical: '/contact' },
    robots: { index: true, follow: true },
  };
}

export default async function ContactPage() {
  const session = await auth();
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  const countryName = LEGAL.countryName === 'Romania' ? 'România' : LEGAL.countryName;
  return (
    <LegalPage
      title="Contact"
      subtitle={
        isRo
          ? 'O persoană reală citește fiecare mesaj. Țintim să răspundem în două zile lucrătoare.'
          : 'A real person reads every message. We aim to reply within two working days.'
      }
      updated={LEGAL.lastUpdated}
    >
      <h2>{isRo ? 'Trimite-ne un mesaj' : 'Send us a message'}</h2>
      <p>
        {isRo ? (
          <>
            Trimiterea acestui formular deschide un tichet de suport. Vei primi un număr de
            referință și răspunsuri pe email; dacă ești autentificat, poți urmări conversația în
            contul tău la <Link href="/support">Suport</Link>.
          </>
        ) : (
          <>
            Submitting this form opens a support ticket. You&rsquo;ll receive a reference number and
            replies by email; if you&rsquo;re signed in you can also follow the conversation in your
            account at <Link href="/support">Support</Link>.
          </>
        )}
      </p>
      <SupportForm
        defaultName={session?.user?.name ?? undefined}
        defaultEmail={session?.user?.email ?? undefined}
      />

      <h2>{isRo ? 'Email direct' : 'Email directly'}</h2>
      <ul>
        <li>
          <strong>{isRo ? 'Suport' : 'Support'}</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>
        </li>
        <li>
          <strong>{isRo ? 'Facturare' : 'Billing'}</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a>
        </li>
        <li>
          <strong>
            {isRo ? 'Confidențialitate și cereri privind datele' : 'Privacy & data requests'}
          </strong>{' '}
          · <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>
        </li>
        <li>
          <strong>
            {isRo ? 'Responsabil cu protecția datelor (DPO)' : 'Data Protection Officer'}
          </strong>{' '}
          · <a href={`mailto:${LEGAL.emails.dpo}`}>{LEGAL.emails.dpo}</a>
        </li>
        <li>
          <strong>{isRo ? 'Abuz / securitate' : 'Abuse / security'}</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.abuse}`}>{LEGAL.emails.abuse}</a>
        </li>
        <li>
          <strong>{isRo ? 'Juridic' : 'Legal'}</strong> ·{' '}
          <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>
        </li>
      </ul>

      <h2>{isRo ? 'Operator' : 'Operator'}</h2>
      <p>
        {isRo ? (
          <>
            {LEGAL.brand} este operat de <strong>{LEGAL.operatorLegalName}</strong> (
            {LEGAL.operatorForm}), cu sediul în {countryName}. Pentru o adresă de facturare sau alte
            cereri legale, trimite un email la{' '}
            <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>.
          </>
        ) : (
          <>
            {LEGAL.brand} is operated by <strong>{LEGAL.operatorLegalName}</strong> (
            {LEGAL.operatorForm}), established in {LEGAL.countryName}. For an invoicing address or
            other legal request, email{' '}
            <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>.
          </>
        )}
      </p>

      <h2>{isRo ? 'În afara programului' : 'Out of office'}</h2>
      <p>
        {isRo ? (
          <>
            Facem tot posibilul să răspundem în două zile lucrătoare (luni–vineri, EET / EEST).
            Tichetele marcate <em>urgent</em> sunt analizate primele.
          </>
        ) : (
          <>
            We do our best to reply within two working days (Monday–Friday, EET / EEST). Tickets
            marked <em>urgent</em> are looked at first.
          </>
        )}
      </p>
    </LegalPage>
  );
}
