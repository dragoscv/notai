import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { ContactForm } from '@/components/legal/contact-form';

export const metadata: Metadata = {
    title: 'Contact',
    description:
        'Get in touch with the Notai team — support, privacy, security, or partnership questions.',
    alternates: { canonical: '/contact' },
    robots: { index: true, follow: true },
};

export default function ContactPage() {
    return (
        <LegalPage
            title="Contact"
            subtitle="A real human reads every message. We aim to reply within two working days."
            updated="2026-05-07"
        >
            <h2>Send us a message</h2>
            <ContactForm />

            <h2>Email directly</h2>
            <ul>
                <li>
                    <strong>Support</strong> ·{' '}
                    <a href="mailto:support@notai.ro">support@notai.ro</a>
                </li>
                <li>
                    <strong>Privacy &amp; data requests</strong> ·{' '}
                    <a href="mailto:privacy@notai.ro">privacy@notai.ro</a>
                </li>
                <li>
                    <strong>Security disclosures</strong> ·{' '}
                    <a href="mailto:security@notai.ro">security@notai.ro</a>
                </li>
                <li>
                    <strong>Press &amp; partnerships</strong> ·{' '}
                    <a href="mailto:hello@notai.ro">hello@notai.ro</a>
                </li>
            </ul>

            <h2>Postal address</h2>
            <p>
                Codai
                <br />
                Romania
            </p>
            <p>
                Need our exact registered address for a contract or invoice? Email{' '}
                <a href="mailto:legal@notai.ro">legal@notai.ro</a> and we&rsquo;ll send it
                over.
            </p>
        </LegalPage>
    );
}
