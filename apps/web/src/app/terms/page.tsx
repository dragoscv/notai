import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The agreement between you and Notai when you use the service.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      subtitle={`The agreement between you and ${LEGAL.brand} when you use the service.`}
      updated={LEGAL.lastUpdated}
    >
      <p>
        Welcome to {LEGAL.brand}. These Terms (the &ldquo;Terms&rdquo;) form a binding contract
        between you and the operator described in section&nbsp;1. By creating an account or using
        the service you agree to be bound by them. If you do not agree, do not use the service.
      </p>

      <h2>1. Who we are</h2>
      <p>
        The {LEGAL.brand} service is operated by <strong>{LEGAL.operatorLegalName}</strong> (
        {LEGAL.operatorForm}), established in {LEGAL.countryName}. You can reach us at{' '}
        <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>. References to
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo; mean the operator. References to
        &ldquo;you&rdquo; mean the natural or legal person using the service.
      </p>

      <h2>2. The service</h2>
      <p>
        {LEGAL.brand} is a local-first notes application with optional cloud sync, sharing,
        AI-assisted features, and collaboration. Some features are free, others require a paid
        subscription described on our <a href="/pricing">pricing page</a>.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 16 years old, or older if your jurisdiction sets a higher age for
        digital consent. By using the service you confirm that you meet this requirement.
      </p>

      <h2>4. Your account</h2>
      <ul>
        <li>You are responsible for the activity on your account and for keeping it secure.</li>
        <li>You must provide accurate information and notify us if it changes materially.</li>
        <li>You may not share account credentials. Each natural person needs their own account.</li>
        <li>
          We may suspend or terminate accounts that violate these Terms or the{' '}
          <a href="/aup">acceptable use policy</a>.
        </li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You retain all rights to the notes, attachments, drawings, and other content you create with{' '}
        {LEGAL.brand} (your &ldquo;Content&rdquo;). You grant us a limited, worldwide, royalty-free
        licence to host, transmit, back up, and display your Content solely as necessary to provide
        the service to you and the people you share with. We do not use your Content to train AI
        models.
      </p>
      <p>
        You are solely responsible for your Content and for ensuring you have the right to upload
        and share it.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        Use of the service is subject to the <a href="/aup">acceptable use policy</a>, which is
        incorporated by reference. We may remove Content or suspend access for violations.
      </p>

      <h2>7. Subscriptions, payment, and renewal</h2>
      <ul>
        <li>
          Paid subscriptions are billed in advance for the period you choose (monthly or yearly) via
          Stripe. Prices and currencies are shown at checkout.
        </li>
        <li>
          Subscriptions renew automatically at the end of each period unless you cancel before the
          renewal date. You can cancel anytime from <em>Settings &rarr; Billing</em>.
        </li>
        <li>
          You authorise us (and Stripe) to charge your payment method for renewals at the
          then-current price for your plan and currency. We will email you in advance if the price
          changes.
        </li>
        <li>
          Failed payments may result in your account being downgraded to the Free plan after a grace
          period.
        </li>
      </ul>

      <h2>8. Right of withdrawal &amp; refunds</h2>
      <p>
        EU consumers have a {LEGAL.refund.rightOfWithdrawalDays}-day right of withdrawal under
        Romanian OUG&nbsp;34/2014. Conditions, exceptions for digital services started immediately,
        and the procedure for requesting a refund are described in detail in our{' '}
        <a href="/refund">refund &amp; withdrawal policy</a>.
      </p>

      <h2>9. Privacy</h2>
      <p>
        We process personal data as described in the <a href="/privacy-policy">privacy policy</a>.
        By using the service you acknowledge that processing.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        The {LEGAL.brand} brand, software, and design are owned by us and protected by copyright,
        trademark, and other laws. We grant you a limited, non-exclusive, non-transferable licence
        to use the service for its intended purpose for the duration of your subscription.
      </p>

      <h2>11. Beta features</h2>
      <p>
        We may offer experimental or beta features. They are provided &ldquo;as is&rdquo;, may be
        changed or discontinued without notice, and are excluded from any availability commitment.
      </p>

      <h2>12. Service availability</h2>
      <p>
        We work hard to keep the service available but do not guarantee uninterrupted operation.
        Planned maintenance is announced in advance where reasonably possible. Status is published
        at <a href={`${LEGAL.url}`}>{LEGAL.domain}</a>.
      </p>

      <h2>13. Disclaimers</h2>
      <p>
        Except where prohibited by mandatory consumer-protection law, the service is provided
        &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether
        express, implied, or statutory. We do not warrant that the service will be uninterrupted,
        error-free, or secure, or that it will meet your specific requirements.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, our aggregate liability arising out of or
        relating to your use of the service is limited to the greater of (a) the amounts you paid us
        in the twelve months preceding the event giving rise to the claim, or (b) EUR&nbsp;100. We
        are not liable for indirect, incidental, special, consequential, or punitive damages, or for
        loss of data, profits, or business opportunities, even if we have been advised of the
        possibility of such damages.
      </p>
      <p>
        Nothing in these Terms limits or excludes any liability that cannot be limited or excluded
        under applicable law &mdash; including liability for fraud, gross negligence, or wilful
        misconduct.
      </p>

      <h2>15. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold us harmless from any third-party claims arising
        from (a) your use of the service in violation of these Terms or applicable law, (b) your
        Content, or (c) your infringement of any third-party rights.
      </p>

      <h2>16. Termination</h2>
      <p>
        You may stop using the service and delete your account at any time. We may suspend or
        terminate access for material breach of these Terms, with notice where reasonably possible.
        Sections that by their nature should survive termination (sections&nbsp;5, 10, 13&ndash;15,
        17&ndash;19) survive.
      </p>

      <h2>17. Changes to the service or these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes are announced in-app and by
        email at least 30 days in advance for paid plans. Continued use of the service after the
        effective date constitutes acceptance of the updated Terms.
      </p>

      <h2>18. Governing law &amp; jurisdiction</h2>
      <p>
        These Terms are governed by {LEGAL.jurisdiction.law}. The courts of{' '}
        {LEGAL.jurisdiction.courts} have exclusive jurisdiction, except where mandatory
        consumer-protection law in your country of residence grants you the right to bring
        proceedings before your local courts.
      </p>

      <h2>19. Dispute resolution &amp; consumer rights</h2>
      <p>
        EU consumers may use the European Commission&rsquo;s online dispute resolution platform at{' '}
        <a href={LEGAL.jurisdiction.odrUrl} target="_blank" rel="noopener">
          {LEGAL.jurisdiction.odrUrl}
        </a>
        . Romanian consumers may also contact{' '}
        <a href={LEGAL.jurisdiction.consumerAuthority.url} target="_blank" rel="noopener">
          {LEGAL.jurisdiction.consumerAuthority.name}
        </a>
        .
      </p>

      <h2>20. Contact</h2>
      <p>
        Legal notices: <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>. General
        support: <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>.
      </p>
    </LegalPage>
  );
}
