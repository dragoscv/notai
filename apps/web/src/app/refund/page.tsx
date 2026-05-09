import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'Refund & withdrawal policy',
  description: 'How refunds and the EU 14-day right of withdrawal work for Notai paid plans.',
  alternates: { canonical: '/refund' },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund &amp; withdrawal policy"
      subtitle="Plain-language summary of our refund rules and your statutory rights as an EU consumer."
      updated={LEGAL.lastUpdated}
    >
      <h2>Summary</h2>
      <ul>
        <li>
          <strong>{LEGAL.refund.rightOfWithdrawalDays}-day right of withdrawal</strong> for EU
          consumers, in line with Romanian OUG&nbsp;34/2014 (transposing EU Directive 2011/83/EU).
        </li>
        <li>
          <strong>Pro-rated refunds</strong> after the 14-day window: if you cancel mid-cycle for a
          documented reason, we refund the unused portion of the period.
        </li>
        <li>
          <strong>No refunds</strong> for AI usage credits already consumed, third-party Stripe fees
          on micro-transactions, or violations of the{' '}
          <a className="underline" href="/aup">
            acceptable use policy
          </a>
          .
        </li>
      </ul>

      <h2>1. Right of withdrawal (EU consumers)</h2>
      <p>
        If you are a consumer in the European Union, you may withdraw from a paid subscription
        within {LEGAL.refund.rightOfWithdrawalDays} days of the purchase, without giving any reason
        and without incurring penalties.
      </p>
      <p>
        <strong>Important exception for digital services:</strong> when you start using paid
        features immediately and you expressly consent to the immediate provision of the service,
        Article&nbsp;16(m) of Directive 2011/83/EU allows us to charge for the portion you have
        actually used. We disclose this consent at checkout. You retain the right to withdraw, but
        the refund is reduced proportionally to the time used.
      </p>
      <p>
        To exercise your right of withdrawal, send a clear statement (email is fine) to{' '}
        <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a> within{' '}
        {LEGAL.refund.rightOfWithdrawalDays} days of the charge. You may use this template:
      </p>
      <blockquote>
        <p>
          <em>
            I, [name], hereby give notice that I withdraw from my contract for the supply of the
            Notai paid subscription concluded on [date]. Account email: [email].
          </em>
        </p>
      </blockquote>

      <h2>2. Pro-rated refunds outside the withdrawal window</h2>
      <p>
        Beyond the statutory 14-day window, refunds are at our discretion. We aim to be fair: if you
        cancel mid-period because of an outage that materially affected your use, an unannounced
        breaking change, or a billing error, contact{' '}
        <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a> within 30 days and we
        will refund the unused portion of the period (rounded down to whole days).
      </p>

      <h2>3. Subscription cancellation</h2>
      <p>
        Cancelling a subscription keeps your plan active until the end of the paid period. We do not
        auto-bill after cancellation. You can cancel anytime from <em>Settings &rarr; Billing</em>{' '}
        or via the Stripe customer portal.
      </p>

      <h2>4. What is not refundable</h2>
      <ul>
        <li>
          AI action credits already consumed (the third-party model providers have already been
          paid).
        </li>
        <li>Stripe transaction fees on currency conversions or micro-payments under EUR&nbsp;5.</li>
        <li>
          Plans terminated for violation of the{' '}
          <a className="underline" href="/aup">
            acceptable use policy
          </a>
          .
        </li>
        <li>Add-ons or one-off purchases consumed in full (where applicable).</li>
      </ul>

      <h2>5. How long refunds take</h2>
      <p>
        Once approved, refunds are issued through Stripe to the original payment method. Stripe
        typically completes the transfer within 5&ndash;10 business days. Bank statements may take
        longer to reflect the credit.
      </p>

      <h2>6. Disputes</h2>
      <p>
        If we cannot agree, EU consumers may use the European Commission&rsquo;s online dispute
        resolution platform at{' '}
        <a href={LEGAL.jurisdiction.odrUrl} rel="noopener" target="_blank">
          {LEGAL.jurisdiction.odrUrl}
        </a>
        . Romanian consumers may also contact{' '}
        <a href={LEGAL.jurisdiction.consumerAuthority.url} rel="noopener" target="_blank">
          {LEGAL.jurisdiction.consumerAuthority.name}
        </a>
        .
      </p>

      <h2>7. Contact</h2>
      <p>
        Refund questions: <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a>.
        Operator: {LEGAL.operatorLegalName} ({LEGAL.operatorForm}), {LEGAL.countryName}.
      </p>
    </LegalPage>
  );
}
