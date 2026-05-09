import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'How Notai collects, processes, and protects your personal data — written for humans first, lawyers second.',
  alternates: { canonical: '/privacy-policy' },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      subtitle="How we collect, process, and protect your personal data — under the EU General Data Protection Regulation (GDPR)."
      updated={LEGAL.lastUpdated}
    >
      <h2>Summary</h2>
      <ul>
        <li>
          {LEGAL.brand} is local-first &mdash; your notes stay on your device unless you sync.
        </li>
        <li>We do not sell your personal data and do not use your notes to train AI.</li>
        <li>
          You can export everything or delete your account anytime from{' '}
          <em>Settings &rarr; Account</em>.
        </li>
        <li>Data is hosted in the European Union. Sub-processors are listed below.</li>
      </ul>

      <h2>1. Who is the data controller?</h2>
      <p>
        The data controller for the personal data described in this policy is{' '}
        <strong>{LEGAL.operatorLegalName}</strong> ({LEGAL.operatorForm}), {LEGAL.countryName}.
        Contact: <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>. For data
        protection matters specifically:{' '}
        <a href={`mailto:${LEGAL.emails.dpo}`}>{LEGAL.emails.dpo}</a>.
      </p>

      <h2>2. What we collect and why</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>What</th>
            <th>Why (lawful basis)</th>
            <th>Retention</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account</td>
            <td>Email, name, profile picture from Google sign-in.</td>
            <td>Contract performance (Art. 6(1)(b) GDPR).</td>
            <td>Until account deletion + 30-day backup retention.</td>
          </tr>
          <tr>
            <td>Notes &amp; attachments</td>
            <td>Content you sync to the cloud, version history, sticky notes.</td>
            <td>Contract performance.</td>
            <td>Until you delete; trash purges after 30 days.</td>
          </tr>
          <tr>
            <td>Billing</td>
            <td>
              Stripe customer ID, country, last4 card, subscription status. Card numbers and CVV
              never reach our servers.
            </td>
            <td>Contract performance + legal obligation (tax law).</td>
            <td>10 years for invoices (Romanian fiscal code).</td>
          </tr>
          <tr>
            <td>Operational logs</td>
            <td>IP addresses, user agent, request URL, timing, error traces.</td>
            <td>Legitimate interest (Art. 6(1)(f)) &mdash; security, debugging.</td>
            <td>30 days, then aggregated.</td>
          </tr>
          <tr>
            <td>Analytics (optional)</td>
            <td>Page views, anonymous usage stats.</td>
            <td>Consent (Art. 6(1)(a)).</td>
            <td>14 months.</td>
          </tr>
          <tr>
            <td>Support tickets</td>
            <td>Anything you send through the contact / support form.</td>
            <td>Consent + legitimate interest.</td>
            <td>3 years from last reply.</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Sub-processors</h2>
      <p>
        We use the following third parties to deliver the service. Each is bound by a written
        data-processing agreement (DPA) with appropriate safeguards.
      </p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong> &mdash; web hosting (EU/US, EU data residency where
          configured).
        </li>
        <li>
          <strong>Google Cloud</strong> &mdash; managed PostgreSQL and supporting services
          (europe-west region).
        </li>
        <li>
          <strong>Cloudflare R2</strong> &mdash; object storage for attachments (EU jurisdiction).
        </li>
        <li>
          <strong>Stripe Payments Europe Ltd.</strong> &mdash; payment processing.
        </li>
        <li>
          <strong>Resend</strong> &mdash; transactional email delivery.
        </li>
        <li>
          <strong>Sentry</strong> &mdash; error monitoring (PII scrubbed).
        </li>
        <li>
          <strong>Auth.js + Google</strong> &mdash; authentication.
        </li>
        <li>
          <strong>OpenAI / Anthropic</strong> &mdash; AI features. Prompts are sent on-demand only
          and are governed by their respective DPAs; no training on your data.
        </li>
      </ul>

      <h2>4. International transfers</h2>
      <p>
        Where a sub-processor stores or processes personal data outside the EU/EEA (e.g. some Stripe
        or AI sub-processing), transfers rely on the European Commission&rsquo;s Standard
        Contractual Clauses (Decision&nbsp;2021/914) and additional safeguards required by GDPR.
      </p>

      <h2>5. Your rights</h2>
      <p>Under GDPR you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Rectify inaccurate data.</li>
        <li>Erase your data (&ldquo;right to be forgotten&rdquo;).</li>
        <li>Restrict or object to specific processing.</li>
        <li>Data portability &mdash; export in a structured, machine-readable format.</li>
        <li>Withdraw consent at any time, without affecting prior lawful processing.</li>
        <li>
          Lodge a complaint with the Romanian data-protection authority{' '}
          <a href={LEGAL.jurisdiction.dpa.url} target="_blank" rel="noopener">
            {LEGAL.jurisdiction.dpa.name}
          </a>{' '}
          or your local supervisory authority.
        </li>
      </ul>
      <p>
        To exercise any right, email{' '}
        <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>. We respond within 30
        days. We may need to verify your identity to prevent unauthorised disclosure.
      </p>

      <h2>6. Children</h2>
      <p>
        {LEGAL.brand} is not directed at children under 16. We do not knowingly collect personal
        data from children under that age. If you believe a child has provided us with personal
        data, contact us and we will delete it.
      </p>

      <h2>7. Cookies</h2>
      <p>
        See our <a href="/cookies">cookie policy</a> for the full list and the consent controls.
      </p>

      <h2>8. Security</h2>
      <p>
        We use industry-standard measures: TLS 1.2+ for data in transit, encryption at rest for the
        managed database and object storage, role-based access control for our team, audit logging
        of admin actions, and regular dependency &amp; vulnerability scanning. No system is
        absolutely secure &mdash; if you discover a vulnerability, please report it to{' '}
        <a href={`mailto:${LEGAL.emails.abuse}`}>{LEGAL.emails.abuse}</a>.
      </p>

      <h2>9. Data breach notification</h2>
      <p>
        In the event of a personal data breach affecting your rights and freedoms, we will notify
        the supervisory authority within 72 hours and inform affected users without undue delay when
        required by GDPR Art.&nbsp;33 &amp; 34.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. Material changes are announced in-app and by email. The
        &ldquo;Last updated&rdquo; date at the top reflects the current version.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>.
        DPO: <a href={`mailto:${LEGAL.emails.dpo}`}>{LEGAL.emails.dpo}</a>.
      </p>
    </LegalPage>
  );
}
