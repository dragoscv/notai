import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { CookieSettingsButtonClient } from '@/components/legal/cookie-settings-button';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'The cookies and similar storage Notai uses, why we use them, and how to change your mind.',
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      subtitle="What we store on your device, why, and how to opt out."
      updated="2026-05-07"
    >
      <h2>1. The simple version</h2>
      <p>
        Notai uses cookies and similar storage (localStorage, sessionStorage, IndexedDB) to sign you
        in, remember your preferences, and — only if you say yes — gather anonymous usage analytics
        so we know which features matter.
      </p>
      <p>
        Optional cookies are off by default. You decide on your first visit and can change your mind
        at any time using the button below.
      </p>
      <p>
        <CookieSettingsButtonClient />
      </p>

      <h2>2. Categories</h2>
      <h3>Strictly necessary (always on)</h3>
      <p>
        Required for sign-in, security (CSRF token), and remembering your consent choice. Disabling
        them would break the app, so they cannot be turned off.
      </p>

      <h3>Preferences</h3>
      <p>
        Remember your theme (light / dark / system), language, and editor width. These cookies stay
        on your device — nothing is sent to any third party.
      </p>

      <h3>Analytics</h3>
      <p>
        If enabled, Notai records anonymous, aggregated metrics: which pages are visited, which
        features are used, performance timings. We never record what you type, the contents of your
        notes, or other personal data. We do not use Google Analytics or any cross-site tracker.
      </p>

      <h3>Marketing</h3>
      <p>
        Currently unused. Notai has no advertising and no third-party marketing pixels. We reserve
        the category for the future (for example, a referral program). It is off by default.
      </p>

      <h2>3. Inventory</h2>
      <div className="not-prose border-border/60 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Purpose</th>
              <th className="px-4 py-2 font-medium">Lifetime</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">authjs.session-token</td>
              <td className="px-4 py-2">Necessary</td>
              <td className="px-4 py-2">Keeps you signed in.</td>
              <td className="px-4 py-2">30 days</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">authjs.csrf-token</td>
              <td className="px-4 py-2">Necessary</td>
              <td className="px-4 py-2">CSRF protection on auth endpoints.</td>
              <td className="px-4 py-2">Session</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">notai_consent</td>
              <td className="px-4 py-2">Necessary</td>
              <td className="px-4 py-2">Remembers your consent choice.</td>
              <td className="px-4 py-2">12 months</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">notai_theme</td>
              <td className="px-4 py-2">Preferences</td>
              <td className="px-4 py-2">Stores light / dark / system theme.</td>
              <td className="px-4 py-2">12 months</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">notai_editor_width</td>
              <td className="px-4 py-2">Preferences</td>
              <td className="px-4 py-2">Editor reading width.</td>
              <td className="px-4 py-2">12 months</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        We do not list third-party advertising or tracking cookies because Notai does not use any.
      </p>

      <h2>4. How to manage cookies</h2>
      <p>
        Use the button at the top of this page to open the consent panel any time. You can also
        clear cookies and site data from your browser settings — the next visit will start fresh.
      </p>

      <h2>5. Changes</h2>
      <p>
        If we add new cookies (for example, when a paid plan launches) we will update this page and
        re-prompt for consent before activating them.
      </p>
    </LegalPage>
  );
}
