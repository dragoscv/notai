import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';

export const metadata: Metadata = {
  title: 'Accessibility statement',
  description:
    'How Notai works toward WCAG 2.1 Level AA conformance and what to do if something stops you from using the app.',
  alternates: { canonical: '/accessibility' },
  robots: { index: true, follow: true },
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility statement"
      subtitle="Built so anyone can take a calm note — keyboard, screen reader, low-vision, or otherwise."
      updated="2026-05-07"
    >
      <h2>Our commitment</h2>
      <p>
        Codai aims to make Notai conform to the{' '}
        <a href="https://www.w3.org/TR/WCAG21/" rel="noopener noreferrer" target="_blank">
          Web Content Accessibility Guidelines (WCAG) 2.1
        </a>{' '}
        at <strong>Level AA</strong>, in line with EU Directive 2016/2102 and the European
        Accessibility Act (Directive 2019/882, in force from 28 June 2025).
      </p>

      <h2>Conformance status</h2>
      <p>
        Notai is <strong>partially conformant</strong> with WCAG 2.1 AA. Most of the application has
        been audited and adjusted; some advanced editor and drawing surfaces are still being
        improved.
      </p>

      <h2>What works well today</h2>
      <ul>
        <li>
          <strong>Keyboard navigation</strong> across the marketing site, sign-in flow, and main app
          shell — including a skip-to-content link.
        </li>
        <li>
          Visible focus rings on every interactive element, with high-contrast colors in both light
          and dark themes.
        </li>
        <li>
          Semantic landmarks (<code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>,{' '}
          <code>&lt;main&gt;</code>, <code>&lt;footer&gt;</code>) on every page.
        </li>
        <li>Accessible names on icon-only buttons and live regions for toast notifications.</li>
        <li>
          Respect for the operating system&rsquo;s <code>prefers-reduced-motion</code> and{' '}
          <code>prefers-color-scheme</code> settings.
        </li>
        <li>
          Page <code>lang</code> attribute set so screen readers pronounce text correctly.
        </li>
        <li>
          Form fields with explicit labels, validation messages tied to inputs via{' '}
          <code>aria-describedby</code>.
        </li>
      </ul>

      <h2>Known limitations</h2>
      <ul>
        <li>
          The drawing canvas relies on pointer input and is not yet fully usable with a keyboard or
          screen reader. We plan to add a keyboard-only shape palette and alternative text input.
        </li>
        <li>
          The rich-text toolbar in the note editor exposes ~25 buttons; we are grouping them into a
          roving-tabindex toolbar to reduce tab presses.
        </li>
        <li>
          Some color combinations on sticky-note tints can dip below the 4.5:1 contrast target; we
          are tuning the palette.
        </li>
      </ul>

      <h2>Testing</h2>
      <p>We use a combination of automated and manual testing:</p>
      <ul>
        <li>axe DevTools and Lighthouse on every page.</li>
        <li>Manual keyboard-only walk-throughs.</li>
        <li>NVDA and VoiceOver smoke tests on the main user journeys.</li>
        <li>Color-contrast checks with the WebAIM contrast checker.</li>
      </ul>

      <h2>Compatibility</h2>
      <p>
        Notai is designed to work with the latest two major versions of Chrome, Edge, Firefox, and
        Safari, paired with the assistive technologies shipped with Windows (Narrator, NVDA), macOS
        (VoiceOver), iOS, and Android.
      </p>

      <h2>Feedback</h2>
      <p>
        If you find an accessibility barrier, please tell us. We aim to respond within 5 working
        days and will fix urgent issues quickly.
      </p>
      <ul>
        <li>
          Email: <a href="mailto:accessibility@notai.ro">accessibility@notai.ro</a>
        </li>
        <li>
          Or use our <a href="/contact">contact form</a>.
        </li>
      </ul>

      <h2>Enforcement</h2>
      <p>
        If you are not satisfied with our response, you can file a complaint with the Romanian
        Authority for the Digitalisation of Romania (ADR) or, where applicable, your national
        accessibility supervisory body.
      </p>
    </LegalPage>
  );
}
