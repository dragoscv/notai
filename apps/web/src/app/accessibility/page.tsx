import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { resolveLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Declarație de accesibilitate' : 'Accessibility statement',
    description: isRo
      ? 'Cum se conformează Notai la WCAG 2.1 nivel AA și ce să faci dacă ceva te împiedică să folosești aplicația.'
      : 'How Notai works toward WCAG 2.1 Level AA conformance and what to do if something stops you from using the app.',
    alternates: { canonical: '/accessibility' },
    robots: { index: true, follow: true },
  };
}

function EnBody() {
  return (
    <>
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
    </>
  );
}

function RoBody() {
  return (
    <>
      <h2>Angajamentul nostru</h2>
      <p>
        Codai țintește ca Notai să fie conform cu{' '}
        <a href="https://www.w3.org/TR/WCAG21/" rel="noopener noreferrer" target="_blank">
          Web Content Accessibility Guidelines (WCAG) 2.1
        </a>{' '}
        la <strong>nivel AA</strong>, în concordanță cu Directiva UE 2016/2102 și European
        Accessibility Act (Directiva 2019/882, în vigoare de la 28 iunie 2025).
      </p>

      <h2>Stadiul conformității</h2>
      <p>
        Notai este <strong>parțial conform</strong> cu WCAG 2.1 AA. Cea mai mare parte a aplicației
        a fost auditată și ajustată; unele suprafețe avansate de editare și desen sunt încă în curs
        de îmbunătățire.
      </p>

      <h2>Ce funcționează bine astăzi</h2>
      <ul>
        <li>
          <strong>Navigare cu tastatura</strong> pe site-ul de marketing, fluxul de autentificare și
          carcasa principală a aplicației — inclusiv link „sari la conținut”.
        </li>
        <li>
          Inele de focus vizibile pe fiecare element interactiv, cu culori de contrast ridicat atât
          în tema deschisă, cât și în cea închisă.
        </li>
        <li>
          Landmark-uri semantice (<code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>,{' '}
          <code>&lt;main&gt;</code>, <code>&lt;footer&gt;</code>) pe fiecare pagină.
        </li>
        <li>
          Nume accesibile pentru butoanele doar-iconițe și live regions pentru notificările toast.
        </li>
        <li>
          Respectarea setărilor sistemului <code>prefers-reduced-motion</code> și{' '}
          <code>prefers-color-scheme</code>.
        </li>
        <li>
          Atribut <code>lang</code> pe pagină pentru ca cititoarele de ecran să pronunțe corect.
        </li>
        <li>
          Câmpuri de formular cu etichete explicite, mesaje de validare legate de input prin{' '}
          <code>aria-describedby</code>.
        </li>
      </ul>

      <h2>Limitări cunoscute</h2>
      <ul>
        <li>
          Pânza de desen se bazează pe input cu pointer și încă nu este complet utilizabilă cu
          tastatura sau cu cititor de ecran. Plănuim să adăugăm o paletă de forme accesibilă din
          tastatură și input text alternativ.
        </li>
        <li>
          Bara de unelte rich-text din editor expune ~25 de butoane; le grupăm într-o bară cu
          roving-tabindex pentru a reduce numărul de Tab-uri.
        </li>
        <li>
          Anumite combinații de culori pe tentele notițelor sticky pot scădea sub raportul țintă de
          contrast 4.5:1; ajustăm paleta.
        </li>
      </ul>

      <h2>Testare</h2>
      <p>Folosim o combinație de testare automată și manuală:</p>
      <ul>
        <li>axe DevTools și Lighthouse pe fiecare pagină.</li>
        <li>Parcurgeri manuale doar cu tastatura.</li>
        <li>Smoke test-uri cu NVDA și VoiceOver pe parcursurile principale.</li>
        <li>Verificări de contrast color cu WebAIM contrast checker.</li>
      </ul>

      <h2>Compatibilitate</h2>
      <p>
        Notai este conceput să funcționeze cu ultimele două versiuni majore ale Chrome, Edge,
        Firefox și Safari, împreună cu tehnologiile asistive livrate cu Windows (Narrator, NVDA),
        macOS (VoiceOver), iOS și Android.
      </p>

      <h2>Feedback</h2>
      <p>
        Dacă găsești o barieră de accesibilitate, te rugăm să ne spui. Țintim să răspundem în 5 zile
        lucrătoare și vom rezolva rapid problemele urgente.
      </p>
      <ul>
        <li>
          Email: <a href="mailto:accessibility@notai.ro">accessibility@notai.ro</a>
        </li>
        <li>
          Sau folosește <a href="/contact">formularul de contact</a>.
        </li>
      </ul>

      <h2>Aplicare</h2>
      <p>
        Dacă nu ești mulțumit de răspunsul nostru, poți depune o plângere la Autoritatea pentru
        Digitalizarea României (ADR) sau, după caz, la organismul național de supraveghere a
        accesibilității.
      </p>
    </>
  );
}

export default async function AccessibilityPage() {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return (
    <LegalPage
      title={isRo ? 'Declarație de accesibilitate' : 'Accessibility statement'}
      subtitle={
        isRo
          ? 'Construit ca oricine să poată lua o notiță cu calm — tastatură, cititor de ecran, vedere slabă sau altfel.'
          : 'Built so anyone can take a calm note — keyboard, screen reader, low-vision, or otherwise.'
      }
      updated="2026-05-07"
    >
      {isRo ? <RoBody /> : <EnBody />}
    </LegalPage>
  );
}
