import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';
import { resolveLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Politica de rambursare și retragere' : 'Refund & withdrawal policy',
    description: isRo
      ? 'Cum funcționează rambursările și dreptul UE de retragere de 14 zile pentru planurile plătite Notai.'
      : 'How refunds and the EU 14-day right of withdrawal work for Notai paid plans.',
    alternates: { canonical: '/refund' },
  };
}

function EnBody() {
  return (
    <>
      <h2>Summary</h2>
      <ul>
        <li>
          <strong>{LEGAL.refund.rightOfWithdrawalDays}-day right of withdrawal</strong> for EU
          consumers, in line with Romanian OUG&nbsp;34/2014 (transposing EU Directive 2011/83/EU).
        </li>
        <li>
          <strong>Pro-rated refunds</strong> after the 14-day window: if you cancel mid-cycle for a
          documented reason, we refund the unused portion of the period.
        </li>
        <li>
          <strong>No refunds</strong> for AI usage credits already consumed, third-party Stripe fees
          on micro-transactions, or violations of the{' '}
          <a className="underline" href="/aup">
            acceptable use policy
          </a>
          .
        </li>
      </ul>

      <h2>1. Right of withdrawal (EU consumers)</h2>
      <p>
        If you are a consumer in the European Union, you may withdraw from a paid subscription
        within {LEGAL.refund.rightOfWithdrawalDays} days of the purchase, without giving any reason
        and without incurring penalties.
      </p>
      <p>
        <strong>Important exception for digital services:</strong> when you start using paid
        features immediately and you expressly consent to the immediate provision of the service,
        Article&nbsp;16(m) of Directive 2011/83/EU allows us to charge for the portion you have
        actually used. We disclose this consent at checkout. You retain the right to withdraw, but
        the refund is reduced proportionally to the time used.
      </p>
      <p>
        To exercise your right of withdrawal, send a clear statement (email is fine) to{' '}
        <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a> within{' '}
        {LEGAL.refund.rightOfWithdrawalDays} days of the charge. You may use this template:
      </p>
      <blockquote>
        <p>
          <em>
            I, [name], hereby give notice that I withdraw from my contract for the supply of the
            Notai paid subscription concluded on [date]. Account email: [email].
          </em>
        </p>
      </blockquote>

      <h2>2. Pro-rated refunds outside the withdrawal window</h2>
      <p>
        Beyond the statutory 14-day window, refunds are at our discretion. We aim to be fair: if you
        cancel mid-period because of an outage that materially affected your use, an unannounced
        breaking change, or a billing error, contact{' '}
        <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a> within 30 days and we
        will refund the unused portion of the period (rounded down to whole days).
      </p>

      <h2>3. Subscription cancellation</h2>
      <p>
        Cancelling a subscription keeps your plan active until the end of the paid period. We do not
        auto-bill after cancellation. You can cancel anytime from <em>Settings &rarr; Billing</em>{' '}
        or via the Stripe customer portal.
      </p>

      <h2>4. What is not refundable</h2>
      <ul>
        <li>
          AI action credits already consumed (the third-party model providers have already been
          paid).
        </li>
        <li>Stripe transaction fees on currency conversions or micro-payments under EUR&nbsp;5.</li>
        <li>
          Plans terminated for violation of the{' '}
          <a className="underline" href="/aup">
            acceptable use policy
          </a>
          .
        </li>
        <li>Add-ons or one-off purchases consumed in full (where applicable).</li>
      </ul>

      <h2>5. How long refunds take</h2>
      <p>
        Once approved, refunds are issued through Stripe to the original payment method. Stripe
        typically completes the transfer within 5&ndash;10 business days. Bank statements may take
        longer to reflect the credit.
      </p>

      <h2>6. Disputes</h2>
      <p>
        If we cannot agree, EU consumers may use the European Commission&rsquo;s online dispute
        resolution platform at{' '}
        <a href={LEGAL.jurisdiction.odrUrl} rel="noopener" target="_blank">
          {LEGAL.jurisdiction.odrUrl}
        </a>
        . Romanian consumers may also contact{' '}
        <a href={LEGAL.jurisdiction.consumerAuthority.url} rel="noopener" target="_blank">
          {LEGAL.jurisdiction.consumerAuthority.name}
        </a>
        .
      </p>

      <h2>7. Contact</h2>
      <p>
        Refund questions: <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a>.
        Operator: {LEGAL.operatorLegalName} ({LEGAL.operatorForm}), {LEGAL.countryName}.
      </p>
    </>
  );
}

function RoBody() {
  const countryName = LEGAL.countryName === 'Romania' ? 'România' : LEGAL.countryName;
  return (
    <>
      <h2>Pe scurt</h2>
      <ul>
        <li>
          <strong>Drept de retragere de {LEGAL.refund.rightOfWithdrawalDays} zile</strong> pentru
          consumatorii UE, conform OUG&nbsp;34/2014 (care transpune Directiva UE 2011/83/UE).
        </li>
        <li>
          <strong>Rambursări proporționale</strong> după fereastra de 14 zile: dacă anulezi în
          mijlocul ciclului dintr-un motiv documentat, rambursăm partea neutilizată din perioadă.
        </li>
        <li>
          <strong>Fără rambursări</strong> pentru credite AI deja consumate, taxe Stripe la
          microtranzacții sau încălcări ale{' '}
          <a className="underline" href="/aup">
            politicii de utilizare acceptabilă
          </a>
          .
        </li>
      </ul>

      <h2>1. Dreptul de retragere (consumatori UE)</h2>
      <p>
        Dacă ești consumator în Uniunea Europeană, te poți retrage dintr-un abonament plătit în
        termen de {LEGAL.refund.rightOfWithdrawalDays} zile de la achiziție, fără a oferi vreun
        motiv și fără penalități.
      </p>
      <p>
        <strong>Excepție importantă pentru servicii digitale:</strong> atunci când începi să
        folosești funcțiile plătite imediat și consimți expres la furnizarea imediată a serviciului,
        Articolul&nbsp;16(m) din Directiva 2011/83/UE ne permite să facturăm partea pe care ai
        folosit-o efectiv. Acest consimțământ este afișat la finalizarea comenzii. Îți păstrezi
        dreptul de retragere, dar rambursarea se reduce proporțional cu timpul folosit.
      </p>
      <p>
        Pentru a-ți exercita dreptul de retragere, trimite o declarație clară (email e suficient) la{' '}
        <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a> în termen de{' '}
        {LEGAL.refund.rightOfWithdrawalDays} zile de la plată. Poți folosi acest model:
      </p>
      <blockquote>
        <p>
          <em>
            Subsemnatul/a [nume], notific prin prezenta retragerea mea din contractul de furnizare a
            abonamentului plătit Notai încheiat la [data]. Email cont: [email].
          </em>
        </p>
      </blockquote>

      <h2>2. Rambursări proporționale în afara ferestrei de retragere</h2>
      <p>
        În afara ferestrei legale de 14 zile, rambursările rămân la latitudinea noastră. Vrem să fim
        corecți: dacă anulezi la mijlocul perioadei din cauza unei indisponibilități care a afectat
        material folosirea, a unei schimbări incompatibile neanunțate sau a unei erori de facturare,
        contactează <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a> în 30 de
        zile și rambursăm partea neutilizată din perioadă (rotunjită în jos la zile întregi).
      </p>

      <h2>3. Anularea abonamentului</h2>
      <p>
        Anularea unui abonament păstrează planul activ până la sfârșitul perioadei plătite. Nu
        facturăm automat după anulare. Poți anula oricând din <em>Setări &rarr; Facturare</em> sau
        prin portalul Stripe pentru clienți.
      </p>

      <h2>4. Ce nu se rambursează</h2>
      <ul>
        <li>
          Credite de acțiuni AI deja consumate (furnizorii modelelor terțe au fost deja plătiți).
        </li>
        <li>Comisioane Stripe pentru conversii valutare sau microplăți sub EUR&nbsp;5.</li>
        <li>
          Planurile reziliate pentru încălcarea{' '}
          <a className="underline" href="/aup">
            politicii de utilizare acceptabilă
          </a>
          .
        </li>
        <li>Add-on-uri sau achiziții unice consumate integral (acolo unde se aplică).</li>
      </ul>

      <h2>5. Cât durează rambursările</h2>
      <p>
        Odată aprobate, rambursările sunt emise prin Stripe către metoda de plată inițială. Stripe
        finalizează de obicei transferul în 5&ndash;10 zile lucrătoare. Extrasele bancare pot
        întârzia reflectarea creditului.
      </p>

      <h2>6. Dispute</h2>
      <p>
        Dacă nu ne putem înțelege, consumatorii UE pot folosi platforma de soluționare online a
        disputelor a Comisiei Europene la{' '}
        <a href={LEGAL.jurisdiction.odrUrl} rel="noopener" target="_blank">
          {LEGAL.jurisdiction.odrUrl}
        </a>
        . Consumatorii români se pot adresa și{' '}
        <a href={LEGAL.jurisdiction.consumerAuthority.url} rel="noopener" target="_blank">
          {LEGAL.jurisdiction.consumerAuthority.name}
        </a>
        .
      </p>

      <h2>7. Contact</h2>
      <p>
        Întrebări despre rambursări:{' '}
        <a href={`mailto:${LEGAL.emails.billing}`}>{LEGAL.emails.billing}</a>. Operator:{' '}
        {LEGAL.operatorLegalName} ({LEGAL.operatorForm}), {countryName}.
      </p>
    </>
  );
}

export default async function RefundPolicyPage() {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return (
    <LegalPage
      title={isRo ? 'Politica de rambursare și retragere' : 'Refund & withdrawal policy'}
      subtitle={
        isRo
          ? 'Rezumat în limbaj clar al regulilor noastre de rambursare și al drepturilor tale legale ca consumator UE.'
          : 'Plain-language summary of our refund rules and your statutory rights as an EU consumer.'
      }
      updated={LEGAL.lastUpdated}
    >
      {isRo ? <RoBody /> : <EnBody />}
    </LegalPage>
  );
}
