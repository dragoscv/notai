import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description:
        'The agreement between you and Codai when you use Notai. Plain language, no surprises.',
    alternates: { canonical: '/terms' },
    robots: { index: true, follow: true },
};

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            subtitle="The simple ground rules for using Notai."
            updated="2026-05-07"
        >
            <h2>1. Who you are dealing with</h2>
            <p>
                Notai is operated by <strong>Codai</strong>, a sole proprietorship
                established in Romania (&quot;we&quot;, &quot;us&quot;). By creating an
                account or using Notai (&quot;the Service&quot;), you agree to these Terms.
                If you do not agree, please do not use the Service.
            </p>

            <h2>2. Your account</h2>
            <p>
                You must be at least 16 years old to create an account. You are responsible
                for keeping your sign-in credentials safe. Tell us at{' '}
                <a href="mailto:security@notai.ro">security@notai.ro</a> if you suspect
                someone else is using your account.
            </p>

            <h2>3. License to use Notai</h2>
            <p>
                We grant you a personal, worldwide, non-exclusive, non-transferable,
                revocable license to use Notai for your own purposes (personal or business),
                subject to these Terms. We may update or improve features at any time.
            </p>

            <h2>4. Your content</h2>
            <p>
                You keep all rights to the notes, drawings, files, and other content you
                upload (&quot;Your Content&quot;). You grant us only the technical license we
                need to host, sync, back up, and display Your Content to you and to people
                you explicitly share with. We do not claim ownership of Your Content and we
                do not use it to train AI models.
            </p>
            <p>
                You are responsible for Your Content and for having the right to upload it.
                Do not upload material that infringes someone else&rsquo;s rights.
            </p>

            <h2>5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
                <li>Break the law or use Notai to harm, harass, or impersonate anyone.</li>
                <li>
                    Upload malware, run automated scrapers, or attempt to disrupt or
                    overload the Service.
                </li>
                <li>
                    Reverse-engineer, decompile, or rent the Service except where the law
                    allows it.
                </li>
                <li>
                    Use Notai to store or distribute content that is illegal in Romania or
                    in your jurisdiction (CSAM, hate speech, terrorism content, etc.).
                </li>
            </ul>
            <p>
                We may suspend or terminate accounts that violate these rules, with or
                without notice when needed to protect users or the Service.
            </p>

            <h2>6. Pricing</h2>
            <p>
                Notai is currently free to use. If we introduce paid plans we will give you
                clear notice and the chance to keep your existing data on a free tier or
                export it.
            </p>

            <h2>7. Beta features</h2>
            <p>
                Some features are marked &quot;beta&quot; or &quot;preview&quot;. They are
                provided as-is and may change or disappear. Avoid relying on them for
                mission-critical workflows.
            </p>

            <h2>8. Intellectual property</h2>
            <p>
                The Notai name, logo, source code, and the layout of the Service are owned
                by Codai or our licensors. Nothing in these Terms transfers any of those
                rights to you.
            </p>

            <h2>9. Third-party services</h2>
            <p>
                Notai integrates with third-party services (Google, GitHub, Vercel, Google
                Cloud, Resend). Their terms and privacy policies apply when you use those
                integrations.
            </p>

            <h2>10. Termination &amp; data export</h2>
            <p>
                You can close your account at any time from the Settings page. We will
                soft-delete your data for 30 days (in case you change your mind), then erase
                it. You can export your notes as JSON before closing the account. We may
                terminate or suspend your account if you materially breach these Terms or if
                we are required to by law.
            </p>

            <h2>11. Warranties &amp; liability</h2>
            <p>
                Notai is provided &quot;as is&quot; and &quot;as available&quot; without
                warranties of any kind, except those that cannot be excluded by law. To the
                maximum extent allowed by Romanian law, our total liability for any claim
                related to the Service is limited to the amount you paid us in the 12 months
                before the claim (or, if the Service is free, to <strong>EUR 50</strong>).
            </p>
            <p>
                Nothing in these Terms limits liability that cannot be limited by law,
                including intentional misconduct, gross negligence, or harm to life or
                bodily integrity.
            </p>

            <h2>12. Indemnity</h2>
            <p>
                You agree to defend and indemnify Codai against claims arising from Your
                Content or your misuse of the Service, except to the extent caused by our
                own breach.
            </p>

            <h2>13. Changes to these Terms</h2>
            <p>
                If we make material changes we will email registered users at least 14 days
                before they take effect. Continuing to use Notai after the effective date
                means you accept the new Terms.
            </p>

            <h2>14. Governing law &amp; disputes</h2>
            <p>
                These Terms are governed by Romanian law. Any dispute that cannot be settled
                amicably will be resolved by the competent courts in Bucharest, Romania,
                without prejudice to any mandatory consumer-protection rights you have in
                your country of residence.
            </p>
            <p>
                EU consumers may also use the European Commission&rsquo;s Online Dispute
                Resolution platform at{' '}
                <a
                    href="https://ec.europa.eu/consumers/odr"
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    ec.europa.eu/consumers/odr
                </a>
                .
            </p>

            <h2>15. Contact</h2>
            <p>
                Codai · Romania
                <br />
                <a href="mailto:legal@notai.ro">legal@notai.ro</a>
            </p>
        </LegalPage>
    );
}
