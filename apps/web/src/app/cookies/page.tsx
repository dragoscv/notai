import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';
import { CookieSettingsButtonClient } from '@/components/legal/cookie-settings-button';
import { resolveLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Politica de cookie-uri' : 'Cookie policy',
    description: isRo
      ? 'Ce cookie-uri și tehnologii similare folosește Notai, ce fac și cum le poți controla.'
      : 'What cookies and similar technologies Notai uses, what they do, and how you can control them.',
    alternates: { canonical: '/cookies' },
  };
}

function EnBody() {
  return (
    <>
      <h2>Summary</h2>
      <ul>
        <li>
          Strictly necessary cookies are always on &mdash; without them you can&rsquo;t sign in.
        </li>
        <li>Optional cookies (preferences, analytics, marketing) require your consent.</li>
        <li>Your choice is saved on this device for 12 months and you can change it anytime.</li>
      </ul>

      <p>
        <CookieSettingsButtonClient />
      </p>

      <h2>1. What is a cookie?</h2>
      <p>
        A cookie is a small text file stored by your browser when you visit a website. Similar
        technologies include <code>localStorage</code>, <code>sessionStorage</code>, and the Service
        Worker cache. Throughout this page &ldquo;cookies&rdquo; refers to all of them.
      </p>

      <h2>2. Cookies we use</h2>
      <h3>Strictly necessary</h3>
      <ul>
        <li>
          <code>authjs.session-token</code> &mdash; keeps you signed in. First-party, expires when
          your session ends or after 30 days.
        </li>
        <li>
          <code>authjs.csrf-token</code>, <code>authjs.callback-url</code> &mdash; protect the
          sign-in flow. First-party, session.
        </li>
        <li>
          <code>{`notai_consent`}</code> &mdash; remembers your cookie choice. First-party, 12
          months.
        </li>
        <li>
          <code>__Secure-*</code> Stripe checkout cookies &mdash; only set on the Stripe-hosted
          payment pages.
        </li>
      </ul>

      <h3>Preferences (optional)</h3>
      <ul>
        <li>
          <code>theme</code> &mdash; remembers light/dark/system. First-party, 12 months.
        </li>
        <li>
          <code>editor.width</code>, <code>sidebar.collapsed</code> &mdash; layout preferences.
          First-party, 12 months.
        </li>
      </ul>

      <h3>Analytics (optional, only with consent)</h3>
      <ul>
        <li>
          <strong>Google Analytics 4</strong> &mdash; aggregated usage statistics so we know which
          features matter. IP anonymisation is on; we do not enable Google Signals.
        </li>
      </ul>

      <h3>Marketing (optional, only with consent)</h3>
      <ul>
        <li>
          <strong>Meta Pixel</strong> &mdash; conversion measurement for ads. Loaded only if you
          consent and only on the marketing pages.
        </li>
      </ul>

      <h3>Operational (necessary, no personal data)</h3>
      <ul>
        <li>
          <strong>Sentry</strong> &mdash; client-side error reporting. PII is scrubbed; cookies are
          first-party and limited to a session ID.
        </li>
      </ul>

      <h2>3. Managing your choices</h2>
      <p>
        Use the consent banner the first time you visit, or open <em>Cookie settings</em> at any
        time using the button above. You can also clear cookies for {LEGAL.domain} in your browser
        settings &mdash; that will reset your choice and the banner will appear again.
      </p>

      <h2>4. Do Not Track</h2>
      <p>
        Browsers send a Do-Not-Track signal in different formats and there is no industry consensus
        on what it means. We treat the Global Privacy Control (GPC) signal as a request to reject
        optional cookies.
      </p>

      <h2>5. Contact</h2>
      <p>
        Cookie or privacy questions:{' '}
        <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>.
      </p>
    </>
  );
}

function RoBody() {
  return (
    <>
      <h2>Pe scurt</h2>
      <ul>
        <li>
          Cookie-urile strict necesare sunt mereu active &mdash; fără ele nu te poți autentifica.
        </li>
        <li>
          Cookie-urile opționale (preferințe, analitice, marketing) necesită consimțământul tău.
        </li>
        <li>
          Alegerea ta este salvată pe acest dispozitiv timp de 12 luni și o poți modifica oricând.
        </li>
      </ul>

      <p>
        <CookieSettingsButtonClient />
      </p>

      <h2>1. Ce este un cookie?</h2>
      <p>
        Un cookie este un mic fișier text stocat de browserul tău când vizitezi un site.
        Tehnologiile similare includ <code>localStorage</code>, <code>sessionStorage</code> și
        cache-ul Service Worker. Pe această pagină, „cookie-uri” se referă la toate aceste
        tehnologii.
      </p>

      <h2>2. Cookie-urile pe care le folosim</h2>
      <h3>Strict necesare</h3>
      <ul>
        <li>
          <code>authjs.session-token</code> &mdash; te ține autentificat. First-party, expiră la
          sfârșitul sesiunii sau după 30 de zile.
        </li>
        <li>
          <code>authjs.csrf-token</code>, <code>authjs.callback-url</code> &mdash; protejează fluxul
          de autentificare. First-party, sesiune.
        </li>
        <li>
          <code>{`notai_consent`}</code> &mdash; reține alegerea ta pentru cookie-uri. First-party,
          12 luni.
        </li>
        <li>
          <code>__Secure-*</code> cookie-uri de checkout Stripe &mdash; setate doar pe paginile de
          plată găzduite de Stripe.
        </li>
      </ul>

      <h3>Preferințe (opționale)</h3>
      <ul>
        <li>
          <code>theme</code> &mdash; reține light/dark/system. First-party, 12 luni.
        </li>
        <li>
          <code>editor.width</code>, <code>sidebar.collapsed</code> &mdash; preferințe de layout.
          First-party, 12 luni.
        </li>
      </ul>

      <h3>Analitice (opționale, doar cu consimțământ)</h3>
      <ul>
        <li>
          <strong>Google Analytics 4</strong> &mdash; statistici agregate de utilizare ca să știm ce
          funcții contează. Anonimizarea IP este activă; nu folosim Google Signals.
        </li>
      </ul>

      <h3>Marketing (opționale, doar cu consimțământ)</h3>
      <ul>
        <li>
          <strong>Meta Pixel</strong> &mdash; măsurarea conversiilor pentru reclame. Încărcat doar
          dacă consimți și doar pe paginile de marketing.
        </li>
      </ul>

      <h3>Operaționale (necesare, fără date personale)</h3>
      <ul>
        <li>
          <strong>Sentry</strong> &mdash; raportarea erorilor pe partea de client. PII este curățat;
          cookie-urile sunt first-party și limitate la un ID de sesiune.
        </li>
      </ul>

      <h2>3. Gestionarea alegerilor tale</h2>
      <p>
        Folosește banner-ul de consimțământ la prima vizită, sau deschide <em>Setări cookie-uri</em>{' '}
        oricând cu butonul de mai sus. Poți, de asemenea, șterge cookie-urile pentru {LEGAL.domain}{' '}
        din setările browserului &mdash; asta va reseta alegerea și banner-ul va apărea din nou.
      </p>

      <h2>4. Do Not Track</h2>
      <p>
        Browserele trimit semnale Do-Not-Track în formate diferite și nu există un consens al
        industriei privind semnificația lor. Tratăm semnalul Global Privacy Control (GPC) ca pe o
        cerere de respingere a cookie-urilor opționale.
      </p>

      <h2>5. Contact</h2>
      <p>
        Întrebări despre cookie-uri sau confidențialitate:{' '}
        <a href={`mailto:${LEGAL.emails.privacy}`}>{LEGAL.emails.privacy}</a>.
      </p>
    </>
  );
}

export default async function CookiesPage() {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return (
    <LegalPage
      title={isRo ? 'Politica de cookie-uri' : 'Cookie policy'}
      subtitle={
        isRo
          ? 'Ce cookie-uri și tehnologii similare folosim, și cum le poți controla.'
          : 'What cookies and similar technologies we use, and how you can control them.'
      }
      updated={LEGAL.lastUpdated}
    >
      {isRo ? <RoBody /> : <EnBody />}
    </LegalPage>
  );
}
