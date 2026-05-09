import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'Acceptable use policy',
  description:
    'What you can and cannot do on Notai. Common-sense rules to keep the service safe for everyone.',
  alternates: { canonical: '/aup' },
};

export default function AupPage() {
  return (
    <LegalPage
      title="Acceptable use policy"
      subtitle="Common-sense rules so Notai stays safe and useful for everyone."
      updated={LEGAL.lastUpdated}
    >
      <p>
        This policy is part of the <a href="/terms">Terms of Service</a>. By using {LEGAL.brand} you
        agree not to use the service in any of the ways listed below.
      </p>

      <h2>1. Illegal content &amp; activity</h2>
      <ul>
        <li>
          Storing, sharing, or transmitting content that is illegal under {LEGAL.countryName} or EU
          law &mdash; including child sexual abuse material (CSAM), terrorist content, or content
          that infringes intellectual property rights.
        </li>
        <li>Using the service to plan, facilitate, or carry out illegal activity.</li>
      </ul>

      <h2>2. Abuse &amp; harassment</h2>
      <ul>
        <li>Threatening, harassing, doxxing, or stalking other users.</li>
        <li>Hate speech or content that incites violence based on protected characteristics.</li>
        <li>Spam, phishing, deceptive content, or impersonation.</li>
      </ul>

      <h2>3. Security &amp; integrity</h2>
      <ul>
        <li>
          Probing, scanning, or testing the security of the service without prior written
          permission.
        </li>
        <li>Bypassing authentication, rate limits, or quota gates.</li>
        <li>
          Uploading malware, viruses, or content designed to harm devices or networks of other
          users.
        </li>
        <li>Reverse-engineering for purposes other than interoperability permitted by law.</li>
      </ul>

      <h2>4. Resource abuse</h2>
      <ul>
        <li>
          Using the service primarily as bulk file storage or as a public CDN. Attachments are bound
          to notes you actively work with.
        </li>
        <li>Automated scraping or training of third-party AI models on data inside Notai.</li>
        <li>
          Running cryptocurrency mining, denial-of-service attacks, or any sustained workload not
          related to the intended use of a notes app.
        </li>
      </ul>

      <h2>5. AI features</h2>
      <ul>
        <li>
          Submitting prompts intended to extract personal data of other users, generate disallowed
          content (CSAM, weapons synthesis instructions, etc.), or jailbreak the underlying models.
        </li>
        <li>Reselling AI features as a standalone product.</li>
      </ul>

      <h2>6. Sharing &amp; public links</h2>
      <ul>
        <li>
          Public share links must not be used to publish content that violates this policy. We may
          revoke any share link that does.
        </li>
      </ul>

      <h2>7. Reporting violations</h2>
      <p>
        Email <a href={`mailto:${LEGAL.emails.abuse}`}>{LEGAL.emails.abuse}</a> with as much detail
        as possible (URL, account, screenshots). We aim to respond within two working days.
      </p>

      <h2>8. Enforcement</h2>
      <p>
        Depending on severity we may issue a warning, remove the offending content, suspend access,
        or terminate the account &mdash; with or without notice for serious violations. We cooperate
        with lawful requests from law-enforcement authorities and may preserve relevant data for
        that purpose.
      </p>

      <h2>9. Appeals</h2>
      <p>
        If you believe an enforcement action against you is mistaken, reply to the enforcement
        notice or email <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a> within 30
        days.
      </p>
    </LegalPage>
  );
}
