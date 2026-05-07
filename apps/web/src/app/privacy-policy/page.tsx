import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Codai collects, uses, and protects personal data when you use Notai — written in plain language and aligned with the GDPR.',
  alternates: { canonical: '/privacy-policy' },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="What data Notai collects, why, and the rights you have over it."
      updated="2026-05-07"
    >
      <h2>1. Who we are</h2>
      <p>
        <strong>Notai</strong> (&quot;the Service&quot;) is operated by <strong>Codai</strong>{' '}
        (&quot;we&quot;, &quot;us&quot;), a sole-proprietorship established in Romania. We are the
        &quot;data controller&quot; for the personal data described in this policy under Regulation
        (EU) 2016/679 (&quot;GDPR&quot;) and Romanian Law no. 190/2018.
      </p>
      <p>
        Reach us about anything privacy-related at{' '}
        <a href="mailto:privacy@notai.ro">privacy@notai.ro</a>. For general support, use{' '}
        <a href="mailto:support@notai.ro">support@notai.ro</a>.
      </p>

      <h2>2. The short version</h2>
      <ul>
        <li>You own your notes. We never sell them or look at them to train models.</li>
        <li>
          We collect the minimum needed to sign you in, sync your notes, and keep the service safe.
        </li>
        <li>
          Optional analytics and preferences cookies are off by default. You decide on your first
          visit and can change your mind anytime from <a href="/cookies">Cookie settings</a>.
        </li>
        <li>Notes are stored on servers in the European Union (Google Cloud, europe-west1).</li>
      </ul>

      <h2>3. What data we collect</h2>
      <h3>3.1 Account data</h3>
      <p>
        When you sign in with Google, GitHub, or another OAuth provider, we receive your name, email
        address, and a profile picture URL. We store these to identify your account and display your
        avatar.
      </p>
      <h3>3.2 Note content</h3>
      <p>
        Everything you write, draw, paste, or upload (titles, text, drawings, sticky notes, PDFs you
        import, file attachments, comments) is saved so you can read it back later and sync it
        across your devices.
      </p>
      <h3>3.3 Technical data</h3>
      <p>
        Like every web service, our infrastructure logs each request: IP address, browser
        user-agent, the URL you accessed, response code, and timestamp. These logs are retained for
        up to 30 days and used only to debug problems and detect abuse.
      </p>
      <h3>3.4 Cookies and similar storage</h3>
      <p>
        See our <a href="/cookies">Cookie Policy</a> for the full inventory.
      </p>

      <h2>4. Why we use it (lawful basis)</h2>
      <ul>
        <li>
          <strong>Performance of a contract</strong> (Art. 6(1)(b) GDPR) — to provide the Service:
          account, sync, sticky-note delivery.
        </li>
        <li>
          <strong>Legitimate interests</strong> (Art. 6(1)(f) GDPR) — to keep the Service secure,
          prevent fraud, and operate basic server logs. You can object at any time.
        </li>
        <li>
          <strong>Consent</strong> (Art. 6(1)(a) GDPR) — for optional analytics and preferences
          cookies. You can withdraw consent at any time.
        </li>
        <li>
          <strong>Legal obligation</strong> (Art. 6(1)(c) GDPR) — when we must respond to a binding
          request from a competent authority.
        </li>
      </ul>

      <h2>5. Who we share data with</h2>
      <p>
        We use a short list of EU-friendly processors. Each one is bound by a Data Processing
        Agreement.
      </p>
      <ul>
        <li>
          <strong>Google Cloud (EU)</strong> — managed PostgreSQL and Cloud Run hosting in
          europe-west1 (Belgium).
        </li>
        <li>
          <strong>Vercel Inc.</strong> — front-end hosting and CDN. Configured to serve from EU
          regions where possible.
        </li>
        <li>
          <strong>Identity providers</strong> — Google and GitHub, only when you sign in with them.
        </li>
        <li>
          <strong>Resend</strong> — transactional email (sign-in links, account notices).
        </li>
      </ul>
      <p>
        We do not sell or rent your personal data. We do not use your notes to train
        machine-learning models.
      </p>

      <h2>6. International transfers</h2>
      <p>
        Your data is processed in the European Economic Area. When a processor must transfer data
        outside the EEA (e.g., a US-based parent company accessing EU infrastructure), the transfer
        is covered by the EU Standard Contractual Clauses (Decision (EU) 2021/914) and, where
        applicable, the EU-US Data Privacy Framework.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>
          <strong>Account &amp; notes</strong>: until you delete them or close your account. After
          account closure we keep a soft-deleted copy for 30 days in case you change your mind, then
          permanently erase it.
        </li>
        <li>
          <strong>Server logs</strong>: 30 days.
        </li>
        <li>
          <strong>Backups</strong>: encrypted database backups are rotated within 35 days.
        </li>
        <li>
          <strong>Billing records</strong> (if you ever subscribe): retained for 10 years per
          Romanian Accounting Law no. 82/1991.
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>Under the GDPR you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate or incomplete data.</li>
        <li>Erase your data (&quot;right to be forgotten&quot;).</li>
        <li>Restrict or object to certain processing.</li>
        <li>Receive your data in a portable, machine-readable format (data portability).</li>
        <li>Withdraw consent at any time without affecting the lawfulness of prior processing.</li>
        <li>
          Lodge a complaint with the Romanian supervisory authority,{' '}
          <a href="https://www.dataprotection.ro/" rel="noopener noreferrer" target="_blank">
            ANSPDCP
          </a>
          , or your local supervisory authority in the EU.
        </li>
      </ul>
      <p>
        To exercise any of these, email <a href="mailto:privacy@notai.ro">privacy@notai.ro</a>. We
        respond within 30 days.
      </p>

      <h2>9. Security</h2>
      <p>
        Notes and credentials travel over TLS 1.3. Passwords are never stored — we use OAuth or
        one-time email links. The database is encrypted at rest. Access to production systems is
        limited to the minimum number of operators and requires hardware-backed two-factor
        authentication.
      </p>

      <h2>10. Children</h2>
      <p>
        Notai is not directed at children under 16. If you believe a child has created an account,
        please contact us and we will delete it.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        If we make material changes we will email registered users at least 14 days before they take
        effect, and update the &quot;last updated&quot; date at the top of this page.
      </p>

      <h2>12. Contact</h2>
      <p>
        Codai · Romania
        <br />
        Email: <a href="mailto:privacy@notai.ro">privacy@notai.ro</a>
        <br />
        Support: <a href="mailto:support@notai.ro">support@notai.ro</a>
      </p>
    </LegalPage>
  );
}
