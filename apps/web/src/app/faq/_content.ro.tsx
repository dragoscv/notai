import Link from 'next/link';
import { LEGAL } from '@/lib/legal-info';
import type { FaqContent } from './_content.types';

export const content: FaqContent = {
  pageTitle: 'Întrebări frecvente',
  pageSubtitle:
    'Răspunsuri scurte la întrebările pe care le auzim cel mai des. Nu o găsești pe a ta? Deschide un tichet.',
  stillStuckTitle: 'Tot blocat?',
  stillStuck: (
    <p>
      <Link href="/support/new">Deschide un tichet de suport</Link> sau scrie pe{' '}
      <a href={`mailto:${LEGAL.emails.support}`}>{LEGAL.emails.support}</a>.
    </p>
  ),
  sections: [
    {
      title: 'Primii pași',
      items: [
        {
          q: 'Ce este Notai?',
          a: (
            <>
              Notai e o aplicație de notițe local-first cu sincronizare opțională în cloud. Notițele
              tale stau în browser sau în aplicația desktop și se sincronizează pe serverele noastre
              doar dacă alegi tu. Susținem text bogat, checklist-uri, atașamente, desene
              (Excalidraw) și note lipicioase.
            </>
          ),
        },
        {
          q: 'Am nevoie de cont?',
          a: (
            <>
              Nu. Poți folosi aplicația web și aplicația desktop complet offline, fără să te
              autentifici. Sincronizarea în cloud, partajarea și backup-urile cer un cont gratuit.
            </>
          ),
        },
        {
          q: 'Ce platforme sunt suportate?',
          a: (
            <>
              Web (orice browser modern), Windows desktop (installer semnat + Microsoft Store),
              macOS (notarizat) și o extensie web-clipper pentru Chrome/Edge. Aplicațiile mobile
              sunt în roadmap.
            </>
          ),
        },
      ],
    },
    {
      title: 'Planuri și facturare',
      items: [
        {
          q: 'Există un plan gratuit?',
          a: (
            <>
              Da. Planul Free acoperă uz personal cu până la 50 de notițe sincronizate, 50&nbsp;MB
              de atașamente și 7 zile de istoric. Notițele locale sunt nelimitate.
            </>
          ),
        },
        {
          q: 'Cum fac upgrade?',
          a: (
            <>
              Din setările de facturare ale aplicației sau de pe{' '}
              <a className="underline" href="/pricing">
                pagina publică de tarife
              </a>
              . Plățile sunt gestionate de Stripe; nu vedem niciodată detaliile cardului tău.
            </>
          ),
        },
        {
          q: 'Pot anula oricând?',
          a: (
            <>
              Da. Poți anula din portalul de facturare. Planul rămâne activ până la finalul
              perioadei curente. Nu facturăm niciodată automat după ce ai anulat.
            </>
          ),
        },
        {
          q: 'Oferiți rambursări?',
          a: (
            <>
              Consumatorii UE beneficiază de un drept de retragere de{' '}
              {LEGAL.refund.rightOfWithdrawalDays} zile conform OUG&nbsp;34/2014 și îl onorăm
              pro-rata pentru utilizare. Detalii complete pe pagina de{' '}
              <a className="underline" href="/refund">
                politică de rambursare
              </a>
              .
            </>
          ),
        },
        {
          q: 'Ce valute acceptați?',
          a: <>EUR, USD și RON. Valuta urmează țara ta de facturare.</>,
        },
      ],
    },
    {
      title: 'Confidențialitate și date',
      items: [
        {
          q: 'Unde sunt stocate datele mele?',
          a: (
            <>
              Local, în browser sau în aplicația desktop, în primul rând. Dacă activezi
              sincronizarea în cloud, copii criptate-în-tranzit stau pe PostgreSQL gestionat în UE
              (Google Cloud, Frankfurt / Belgia, în funcție de proiect) și pe Cloudflare R2 pentru
              atașamente.
            </>
          ),
        },
        {
          q: 'Antrenați AI pe notițele mele?',
          a: (
            <>
              Nu. Notițele tale nu sunt folosite niciodată pentru a antrena modele AI.
              Funcționalitățile AI rulează la cerere.
            </>
          ),
        },
        {
          q: 'Cum îmi exportez sau șterg datele?',
          a: (
            <>
              Poți exporta totul din <em>Setări → Cont</em> ca arhivă Markdown sau poți șterge
              permanent contul din același ecran. Ștergerea îndepărtează datele de pe serverele
              noastre în 30 de zile.
            </>
          ),
        },
        {
          q: 'Sunteți conformi GDPR?',
          a: (
            <>
              Da.{' '}
              <a className="underline" href="/privacy-policy">
                Politica completă de confidențialitate
              </a>{' '}
              descrie bazele legale, drepturile persoanelor vizate și retenția. Cererile DSAR se
              trimit la{' '}
              <a className="underline" href={`mailto:${LEGAL.emails.privacy}`}>
                {LEGAL.emails.privacy}
              </a>
              .
            </>
          ),
        },
      ],
    },
    {
      title: 'Sincronizare și colaborare',
      items: [
        {
          q: 'Cum funcționează sincronizarea?',
          a: (
            <>
              Notițele folosesc CRDT-uri (Yjs peste Hocuspocus), astfel încât editările de pe mai
              multe dispozitive se îmbină fără conflicte. Notele lipicioase oglindesc nota părinte
              în timp real.
            </>
          ),
        },
        {
          q: 'Pot partaja o notiță?',
          a: (
            <>
              Da — linkuri doar-citire sau de editare, opțional protejate cu parolă și dată de
              expirare. Planul Pro adaugă slug-uri personalizate.
            </>
          ),
        },
        {
          q: 'Pot lucra offline?',
          a: (
            <>
              Mereu. Schimbările se pun în coadă local și se sincronizează în momentul în care ești
              din nou online.
            </>
          ),
        },
      ],
    },
    {
      title: 'Cont și securitate',
      items: [
        {
          q: 'Cum mă autentific?',
          a: (
            <>
              Autentificare cu Google via Auth.js, plus passkeys (Touch ID, Face ID, Windows Hello
              sau orice cheie hardware FIDO2). Adaugi o passkey din{' '}
              <Link className="underline" href="/app/settings/security">
                Setări → Securitate
              </Link>
              .
            </>
          ),
        },
        {
          q: 'Mi-am pierdut accesul la email — ce fac?',
          a: (
            <>
              Deschide un{' '}
              <Link className="underline" href="/support/new">
                tichet de suport
              </Link>{' '}
              cu categoria „Ajutor cont” și îți verificăm identitatea înainte să transferăm accesul.
            </>
          ),
        },
        {
          q: 'Cred că am găsit o problemă de securitate.',
          a: (
            <>
              Te rog scrie la{' '}
              <a className="underline" href={`mailto:${LEGAL.emails.abuse}`}>
                {LEGAL.emails.abuse}
              </a>{' '}
              cu detalii. Nu avem încă un program plătit de bug bounty, dar creditează divulgările
              responsabile.
            </>
          ),
        },
      ],
    },
  ],
  schemaItems: [
    {
      question: 'Ce este Notai?',
      answer:
        'Notai e o aplicație de notițe local-first cu sincronizare opțională în cloud. Notițele tale stau în browser sau în aplicația desktop și se sincronizează pe serverele noastre doar dacă alegi tu. Susținem text bogat, checklist-uri, atașamente, desene (Excalidraw) și note lipicioase.',
    },
    {
      question: 'Am nevoie de cont?',
      answer:
        'Nu. Poți folosi aplicația web și aplicația desktop complet offline, fără să te autentifici. Sincronizarea în cloud, partajarea și backup-urile cer un cont gratuit.',
    },
    {
      question: 'Ce platforme sunt suportate?',
      answer:
        'Web (orice browser modern), Windows desktop (installer semnat + Microsoft Store), macOS (notarizat) și o extensie web-clipper pentru Chrome/Edge. Aplicațiile mobile sunt în roadmap.',
    },
    {
      question: 'Există un plan gratuit?',
      answer:
        'Da. Planul Free acoperă uz personal cu până la 50 de notițe sincronizate, 50 MB de atașamente și 7 zile de istoric. Notițele locale sunt nelimitate.',
    },
    {
      question: 'Unde sunt stocate datele mele?',
      answer:
        'Notițele pe care alegi să le sincronizezi sunt stocate în baza noastră PostgreSQL găzduită pe Google Cloud (regiunea: europe-west3, Frankfurt). Atașamentele stau în Google Cloud Storage în aceeași regiune. Notițele doar-locale nu părăsesc dispozitivul tău.',
    },
    {
      question: 'Notai e conform GDPR?',
      answer:
        'Da. Notai este operat din România (UE), datele stau în UE și oferim export complet și ștergere a contului din Setări. Vezi Politica de Confidențialitate pentru detalii despre prelucrare.',
    },
  ],
};
