import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';
import { resolveLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Politica de utilizare acceptabilă' : 'Acceptable use policy',
    description: isRo
      ? 'Ce poți și ce nu poți face pe Notai. Reguli de bun-simț ca serviciul să rămână sigur pentru toți.'
      : 'What you can and cannot do on Notai. Common-sense rules to keep the service safe for everyone.',
    alternates: { canonical: '/aup' },
  };
}

function EnBody() {
  return (
    <>
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
    </>
  );
}

function RoBody() {
  const countryName = LEGAL.countryName === 'Romania' ? 'România' : LEGAL.countryName;
  return (
    <>
      <p>
        Această politică face parte din <a href="/terms">Termenii și condițiile</a>. Folosind{' '}
        {LEGAL.brand} ești de acord să nu folosești serviciul în vreunul din modurile listate mai
        jos.
      </p>

      <h2>1. Conținut și activități ilegale</h2>
      <ul>
        <li>
          Stocarea, partajarea sau transmiterea de conținut ilegal conform legii din {countryName}{' '}
          sau a UE &mdash; inclusiv material de abuz sexual asupra copiilor (CSAM), conținut
          terorist sau conținut care încalcă drepturile de proprietate intelectuală.
        </li>
        <li>
          Folosirea serviciului pentru a planifica, facilita sau desfășura activități ilegale.
        </li>
      </ul>

      <h2>2. Abuz și hărțuire</h2>
      <ul>
        <li>Amenințarea, hărțuirea, doxxing-ul sau urmărirea altor utilizatori.</li>
        <li>
          Discurs de ură sau conținut care incită la violență pe bază de caracteristici protejate.
        </li>
        <li>Spam, phishing, conținut înșelător sau uzurpare de identitate.</li>
      </ul>

      <h2>3. Securitate și integritate</h2>
      <ul>
        <li>
          Sondarea, scanarea sau testarea securității serviciului fără permisiune scrisă prealabilă.
        </li>
        <li>Ocolirea autentificării, a limitelor de rată sau a cotelor.</li>
        <li>
          Încărcarea de malware, viruși sau conținut conceput să dăuneze dispozitivelor ori
          rețelelor altor utilizatori.
        </li>
        <li>Reverse engineering în alte scopuri decât interoperabilitatea permisă de lege.</li>
      </ul>

      <h2>4. Abuz de resurse</h2>
      <ul>
        <li>
          Folosirea serviciului în principal ca depozit bulk de fișiere sau ca CDN public.
          Atașamentele sunt legate de notițele cu care lucrezi efectiv.
        </li>
        <li>Scraping automat sau antrenarea de modele AI terțe pe datele din Notai.</li>
        <li>
          Rularea de minerit de criptomonede, atacuri DoS sau orice sarcină susținută fără legătură
          cu folosirea normală a unei aplicații de notițe.
        </li>
      </ul>

      <h2>5. Funcționalități AI</h2>
      <ul>
        <li>
          Trimiterea de prompturi menite să extragă date personale ale altor utilizatori, să
          genereze conținut interzis (CSAM, instrucțiuni de sinteză a armelor etc.) sau să facă
          jailbreak modelelor.
        </li>
        <li>Revânzarea funcționalităților AI ca produs de sine stătător.</li>
      </ul>

      <h2>6. Partajare și linkuri publice</h2>
      <ul>
        <li>
          Linkurile publice de partajare nu pot fi folosite pentru a publica conținut care încalcă
          această politică. Putem revoca orice link de partajare care o face.
        </li>
      </ul>

      <h2>7. Raportarea încălcărilor</h2>
      <p>
        Trimite un email la <a href={`mailto:${LEGAL.emails.abuse}`}>{LEGAL.emails.abuse}</a> cu cât
        mai multe detalii posibile (URL, cont, capturi). Țintim să răspundem în două zile
        lucrătoare.
      </p>

      <h2>8. Aplicare</h2>
      <p>
        În funcție de gravitate, putem emite un avertisment, elimina conținutul, suspenda accesul
        sau rezilia contul &mdash; cu sau fără preaviz în cazul încălcărilor grave. Cooperăm cu
        cererile legale ale autorităților și putem păstra datele relevante în acest scop.
      </p>

      <h2>9. Apeluri</h2>
      <p>
        Dacă crezi că o acțiune de aplicare împotriva ta este greșită, răspunde la notificarea de
        aplicare sau trimite un email la{' '}
        <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a> în 30 de zile.
      </p>
    </>
  );
}

export default async function AupPage() {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return (
    <LegalPage
      title={isRo ? 'Politica de utilizare acceptabilă' : 'Acceptable use policy'}
      subtitle={
        isRo
          ? 'Reguli de bun-simț ca Notai să rămână sigur și util pentru toți.'
          : 'Common-sense rules so Notai stays safe and useful for everyone.'
      }
      updated={LEGAL.lastUpdated}
    >
      {isRo ? <RoBody /> : <EnBody />}
    </LegalPage>
  );
}
