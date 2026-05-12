import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';
import { resolveLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Termeni și condiții' : 'Terms of service',
    description: isRo
      ? 'Acordul dintre tine și Notai atunci când folosești serviciul.'
      : 'The agreement between you and Notai when you use the service.',
    alternates: { canonical: '/terms' },
  };
}

function EnBody() {
  return (
    <>
      <p>
        Welcome to {LEGAL.brand}. These Terms (the &ldquo;Terms&rdquo;) form a binding contract
        between you and the operator described in section&nbsp;1. By creating an account or using
        the service you agree to be bound by them. If you do not agree, do not use the service.
      </p>

      <h2>1. Who we are</h2>
      <p>
        The {LEGAL.brand} service is operated by <strong>{LEGAL.operatorLegalName}</strong> (
        {LEGAL.operatorForm}), established in {LEGAL.countryName}. You can reach us at{' '}
        <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>. References to
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo; mean the operator. References to
        &ldquo;you&rdquo; mean the natural or legal person using the service.
      </p>

      <h2>2. The service</h2>
      <p>
        {LEGAL.brand} is a local-first notes application with optional cloud sync, sharing,
        AI-assisted features, and collaboration. Some features are free, others require a paid
        subscription described on our <a href="/pricing">pricing page</a>.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 16 years old, or older if your jurisdiction sets a higher age for
        digital consent. By using the service you confirm that you meet this requirement.
      </p>

      <h2>4. Your account</h2>
      <ul>
        <li>You are responsible for the activity on your account and for keeping it secure.</li>
        <li>You must provide accurate information and notify us if it changes materially.</li>
        <li>You may not share account credentials. Each natural person needs their own account.</li>
        <li>
          We may suspend or terminate accounts that violate these Terms or the{' '}
          <a href="/aup">acceptable use policy</a>.
        </li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You retain all rights to the notes, attachments, drawings, and other content you create with{' '}
        {LEGAL.brand} (your &ldquo;Content&rdquo;). You grant us a limited, worldwide, royalty-free
        licence to host, transmit, back up, and display your Content solely as necessary to provide
        the service to you and the people you share with. We do not use your Content to train AI
        models.
      </p>
      <p>
        You are solely responsible for your Content and for ensuring you have the right to upload
        and share it.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        Use of the service is subject to the <a href="/aup">acceptable use policy</a>, which is
        incorporated by reference. We may remove Content or suspend access for violations.
      </p>

      <h2>7. Subscriptions, payment, and renewal</h2>
      <ul>
        <li>
          Paid subscriptions are billed in advance for the period you choose (monthly or yearly) via
          Stripe. Prices and currencies are shown at checkout.
        </li>
        <li>
          Subscriptions renew automatically at the end of each period unless you cancel before the
          renewal date. You can cancel anytime from <em>Settings &rarr; Billing</em>.
        </li>
        <li>
          You authorise us (and Stripe) to charge your payment method for renewals at the
          then-current price for your plan and currency. We will email you in advance if the price
          changes.
        </li>
        <li>
          Failed payments may result in your account being downgraded to the Free plan after a grace
          period.
        </li>
      </ul>

      <h2>8. Right of withdrawal &amp; refunds</h2>
      <p>
        EU consumers have a {LEGAL.refund.rightOfWithdrawalDays}-day right of withdrawal under
        Romanian OUG&nbsp;34/2014. Conditions, exceptions for digital services started immediately,
        and the procedure for requesting a refund are described in detail in our{' '}
        <a href="/refund">refund &amp; withdrawal policy</a>.
      </p>

      <h2>9. Privacy</h2>
      <p>
        We process personal data as described in the <a href="/privacy-policy">privacy policy</a>.
        By using the service you acknowledge that processing.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        The {LEGAL.brand} brand, software, and design are owned by us and protected by copyright,
        trademark, and other laws. We grant you a limited, non-exclusive, non-transferable licence
        to use the service for its intended purpose for the duration of your subscription.
      </p>

      <h2>11. Beta features</h2>
      <p>
        We may offer experimental or beta features. They are provided &ldquo;as is&rdquo;, may be
        changed or discontinued without notice, and are excluded from any availability commitment.
      </p>

      <h2>12. Service availability</h2>
      <p>
        We work hard to keep the service available but do not guarantee uninterrupted operation.
        Planned maintenance is announced in advance where reasonably possible. Status is published
        at <a href={`${LEGAL.url}`}>{LEGAL.domain}</a>.
      </p>

      <h2>13. Disclaimers</h2>
      <p>
        Except where prohibited by mandatory consumer-protection law, the service is provided
        &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether
        express, implied, or statutory. We do not warrant that the service will be uninterrupted,
        error-free, or secure, or that it will meet your specific requirements.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, our aggregate liability arising out of or
        relating to your use of the service is limited to the greater of (a) the amounts you paid us
        in the twelve months preceding the event giving rise to the claim, or (b) EUR&nbsp;100. We
        are not liable for indirect, incidental, special, consequential, or punitive damages, or for
        loss of data, profits, or business opportunities, even if we have been advised of the
        possibility of such damages.
      </p>
      <p>
        Nothing in these Terms limits or excludes any liability that cannot be limited or excluded
        under applicable law &mdash; including liability for fraud, gross negligence, or wilful
        misconduct.
      </p>

      <h2>15. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold us harmless from any third-party claims arising
        from (a) your use of the service in violation of these Terms or applicable law, (b) your
        Content, or (c) your infringement of any third-party rights.
      </p>

      <h2>16. Termination</h2>
      <p>
        You may stop using the service and delete your account at any time. We may suspend or
        terminate access for material breach of these Terms, with notice where reasonably possible.
        Sections that by their nature should survive termination (sections&nbsp;5, 10, 13&ndash;15,
        17&ndash;19) survive.
      </p>

      <h2>17. Changes to the service or these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes are announced in-app and by
        email at least 30 days in advance for paid plans. Continued use of the service after the
        effective date constitutes acceptance of the updated Terms.
      </p>

      <h2>18. Governing law &amp; jurisdiction</h2>
      <p>
        These Terms are governed by {LEGAL.jurisdiction.law}. The courts of{' '}
        {LEGAL.jurisdiction.courts} have exclusive jurisdiction, except where mandatory
        consumer-protection law in your country of residence grants you the right to bring
        proceedings before your local courts.
      </p>

      <h2>19. Dispute resolution &amp; consumer rights</h2>
      <p>
        EU consumers may use the European Commission&rsquo;s online dispute resolution platform at{' '}
        <a href={LEGAL.jurisdiction.odrUrl} target="_blank" rel="noopener">
          {LEGAL.jurisdiction.odrUrl}
        </a>
        . Romanian consumers may also contact{' '}
        <a href={LEGAL.jurisdiction.consumerAuthority.url} target="_blank" rel="noopener">
          {LEGAL.jurisdiction.consumerAuthority.name}
        </a>
        .
      </p>

      <h2>20. Contact</h2>
      <p>
        Legal notices: <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>. General
        support: <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>.
      </p>
    </>
  );
}

function RoBody() {
  return (
    <>
      <p>
        Bun venit la {LEGAL.brand}. Acești Termeni („Termenii”) formează un contract obligatoriu
        între tine și operatorul descris la secțiunea&nbsp;1. Prin crearea unui cont sau folosirea
        serviciului accepți să respecți acești Termeni. Dacă nu ești de acord, nu folosi serviciul.
      </p>

      <h2>1. Cine suntem</h2>
      <p>
        Serviciul {LEGAL.brand} este operat de <strong>{LEGAL.operatorLegalName}</strong> (
        {LEGAL.operatorForm}), cu sediul în{' '}
        {LEGAL.countryName === 'Romania' ? 'România' : LEGAL.countryName}. Ne poți contacta la{' '}
        <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>. Referințele la „noi”
        înseamnă operatorul. Referințele la „tu” înseamnă persoana fizică sau juridică care
        folosește serviciul.
      </p>

      <h2>2. Serviciul</h2>
      <p>
        {LEGAL.brand} este o aplicație de notițe local-first, cu sincronizare cloud opțională,
        partajare, funcții asistate de AI și colaborare. Unele funcții sunt gratuite, altele
        necesită un abonament plătit descris pe <a href="/pricing">pagina de prețuri</a>.
      </p>

      <h2>3. Eligibilitate</h2>
      <p>
        Trebuie să ai cel puțin 16 ani, sau mai mult dacă jurisdicția ta cere o vârstă mai mare
        pentru consimțământ digital. Folosind serviciul, confirmi că îndeplinești această cerință.
      </p>

      <h2>4. Contul tău</h2>
      <ul>
        <li>
          Ești responsabil pentru activitatea din contul tău și pentru păstrarea lui în siguranță.
        </li>
        <li>
          Trebuie să furnizezi informații exacte și să ne anunți dacă acestea se schimbă
          semnificativ.
        </li>
        <li>
          Nu poți partaja credențialele contului. Fiecare persoană fizică are nevoie de cont
          propriu.
        </li>
        <li>
          Putem suspenda sau închide conturile care încalcă acești Termeni sau{' '}
          <a href="/aup">politica de utilizare acceptabilă</a>.
        </li>
      </ul>

      <h2>5. Conținutul tău</h2>
      <p>
        Păstrezi toate drepturile asupra notițelor, atașamentelor, desenelor și a oricărui conținut
        creat cu {LEGAL.brand} („Conținutul” tău). Ne acorzi o licență limitată, mondială, fără
        redevențe, pentru a găzdui, transmite, face copii de rezervă și afișa Conținutul tău, strict
        cât este necesar pentru a-ți oferi serviciul și a-l partaja cu persoanele alese de tine. Nu
        folosim Conținutul tău pentru a antrena modele AI.
      </p>
      <p>
        Ești singurul responsabil pentru Conținutul tău și pentru a te asigura că ai dreptul să-l
        încarci și să-l partajezi.
      </p>

      <h2>6. Utilizare acceptabilă</h2>
      <p>
        Folosirea serviciului este supusă <a href="/aup">politicii de utilizare acceptabilă</a>,
        care este încorporată prin referință. Putem elimina Conținut sau suspenda accesul în caz de
        încălcare.
      </p>

      <h2>7. Abonamente, plată și reînnoire</h2>
      <ul>
        <li>
          Abonamentele plătite sunt facturate în avans pentru perioada aleasă (lunar sau anual) prin
          Stripe. Prețurile și valutele sunt afișate la finalizarea comenzii.
        </li>
        <li>
          Abonamentele se reînnoiesc automat la sfârșitul fiecărei perioade dacă nu anulezi înainte
          de data reînnoirii. Poți anula oricând din <em>Setări &rarr; Facturare</em>.
        </li>
        <li>
          Ne autorizezi (pe noi și pe Stripe) să percepem metoda ta de plată pentru reînnoiri la
          prețul curent al planului și valutei tale. Te vom anunța pe email cu suficient timp
          înainte dacă prețul se schimbă.
        </li>
        <li>
          Plățile eșuate pot duce la trecerea contului la planul Gratuit după o perioadă de grație.
        </li>
      </ul>

      <h2>8. Dreptul de retragere și rambursări</h2>
      <p>
        Consumatorii din UE au un drept de retragere de {LEGAL.refund.rightOfWithdrawalDays} zile
        conform OUG&nbsp;34/2014 (România). Condițiile, excepțiile pentru servicii digitale începute
        imediat și procedura pentru a solicita o rambursare sunt descrise în detaliu în{' '}
        <a href="/refund">politica de rambursare și retragere</a>.
      </p>

      <h2>9. Confidențialitate</h2>
      <p>
        Prelucrăm datele cu caracter personal conform{' '}
        <a href="/privacy-policy">politicii de confidențialitate</a>. Folosind serviciul, iei la
        cunoștință această prelucrare.
      </p>

      <h2>10. Proprietate intelectuală</h2>
      <p>
        Brandul, software-ul și designul {LEGAL.brand} ne aparțin și sunt protejate prin drepturi de
        autor, mărci și alte legi. Îți acordăm o licență limitată, neexclusivă, netransferabilă de a
        folosi serviciul în scopul său prevăzut pe durata abonamentului tău.
      </p>

      <h2>11. Funcționalități beta</h2>
      <p>
        Putem oferi funcționalități experimentale sau beta. Acestea sunt furnizate „așa cum sunt”,
        pot fi modificate sau retrase fără preaviz și sunt excluse de la orice angajament de
        disponibilitate.
      </p>

      <h2>12. Disponibilitatea serviciului</h2>
      <p>
        Depunem eforturi pentru a menține serviciul disponibil, dar nu garantăm funcționarea
        neîntreruptă. Mentenanța planificată este anunțată în avans atunci când este rezonabil
        posibil. Starea serviciului este publicată la <a href={`${LEGAL.url}`}>{LEGAL.domain}</a>.
      </p>

      <h2>13. Limitarea garanțiilor</h2>
      <p>
        Cu excepția cazurilor interzise de legislația obligatorie privind protecția consumatorilor,
        serviciul este furnizat „așa cum este” și „așa cum este disponibil”, fără garanții de niciun
        fel, exprese, implicite sau statutare. Nu garantăm că serviciul va fi neîntrerupt, fără
        erori sau securizat, sau că va îndeplini cerințele tale specifice.
      </p>

      <h2>14. Limitarea răspunderii</h2>
      <p>
        În măsura maximă permisă de legea aplicabilă, răspunderea noastră totală care decurge din
        sau este legată de folosirea serviciului este limitată la valoarea cea mai mare dintre (a)
        sumele plătite de tine în cele douăsprezece luni anterioare evenimentului care a dat naștere
        cererii, sau (b) EUR&nbsp;100. Nu suntem răspunzători pentru daune indirecte, incidentale,
        speciale, consecvente sau punitive, ori pentru pierderi de date, profit sau oportunități de
        afaceri, chiar dacă am fost informați despre posibilitatea unor astfel de daune.
      </p>
      <p>
        Nimic din acești Termeni nu limitează sau exclude vreo răspundere care nu poate fi limitată
        sau exclusă conform legii aplicabile — inclusiv răspunderea pentru fraudă, neglijență gravă
        sau intenție.
      </p>

      <h2>15. Despăgubiri</h2>
      <p>
        Ești de acord să ne aperi, despăgubești și ne ții indemni față de orice pretenții ale
        terților rezultate din (a) folosirea serviciului cu încălcarea acestor Termeni sau a legii
        aplicabile, (b) Conținutul tău, sau (c) încălcarea de către tine a drepturilor unor terți.
      </p>

      <h2>16. Încetare</h2>
      <p>
        Poți înceta folosirea serviciului și șterge contul oricând. Putem suspenda sau înceta
        accesul pentru încălcări materiale ale acestor Termeni, cu preaviz acolo unde este rezonabil
        posibil. Secțiunile care prin natura lor ar trebui să supraviețuiască încetării
        (secțiunile&nbsp;5, 10, 13&ndash;15, 17&ndash;19) supraviețuiesc.
      </p>

      <h2>17. Modificări ale serviciului sau ale Termenilor</h2>
      <p>
        Putem actualiza acești Termeni din când în când. Modificările materiale sunt anunțate în-app
        și prin email cu cel puțin 30 de zile în avans pentru planurile plătite. Folosirea continuă
        a serviciului după data de intrare în vigoare constituie acceptarea Termenilor actualizați.
      </p>

      <h2>18. Lege aplicabilă și jurisdicție</h2>
      <p>
        Acești Termeni sunt guvernați de legea română. Instanțele competente din România au
        jurisdicție exclusivă, cu excepția cazurilor în care legislația obligatorie privind
        protecția consumatorilor din țara ta de rezidență îți acordă dreptul de a introduce acțiuni
        în fața instanțelor locale.
      </p>

      <h2>19. Soluționarea disputelor și drepturile consumatorilor</h2>
      <p>
        Consumatorii din UE pot folosi platforma de soluționare online a disputelor a Comisiei
        Europene la{' '}
        <a href={LEGAL.jurisdiction.odrUrl} target="_blank" rel="noopener">
          {LEGAL.jurisdiction.odrUrl}
        </a>
        . Consumatorii români se pot adresa și{' '}
        <a href={LEGAL.jurisdiction.consumerAuthority.url} target="_blank" rel="noopener">
          {LEGAL.jurisdiction.consumerAuthority.name}
        </a>
        .
      </p>

      <h2>20. Contact</h2>
      <p>
        Notificări legale: <a href={`mailto:${LEGAL.emails.legal}`}>{LEGAL.emails.legal}</a>. Suport
        general: <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>.
      </p>
    </>
  );
}

export default async function TermsPage() {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return (
    <LegalPage
      title={isRo ? 'Termeni și condiții' : 'Terms of service'}
      subtitle={
        isRo
          ? `Acordul dintre tine și ${LEGAL.brand} atunci când folosești serviciul.`
          : `The agreement between you and ${LEGAL.brand} when you use the service.`
      }
      updated={LEGAL.lastUpdated}
    >
      {isRo ? <RoBody /> : <EnBody />}
    </LegalPage>
  );
}
