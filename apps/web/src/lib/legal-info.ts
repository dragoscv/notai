/**
 * Single source of truth for legal/operator information shown across the
 * marketing & legal pages, support pages, and emails. Update here, every
 * page reflects it.
 */

export const LEGAL = {
  /** Brand name shown to users. */
  brand: 'Notai',
  /** Operating entity for legal disclosures (Romanian PFA / persoană fizică). */
  operatorLegalName: 'Vlăduțescu Dragoș Cătălin',
  operatorForm: 'persoană fizică',
  /** Country the operator is established in (used for jurisdiction clauses). */
  countryName: 'Romania',
  countryCode: 'RO',
  /** Public website. */
  domain: 'notai.ro',
  url: 'https://notai.ro',
  /** Contact addresses — these are the canonical ones used in legal text. */
  emails: {
    support: 'support@notai.ro',
    privacy: 'privacy@notai.ro',
    dpo: 'dpo@notai.ro',
    legal: 'legal@notai.ro',
    abuse: 'abuse@notai.ro',
    billing: 'billing@notai.ro',
  },
  /** Last revision date for legal documents. Bump when wording changes. */
  lastUpdated: '2026-05-09',
  /** Refund policy summary — kept in one place so /refund and /terms agree. */
  refund: {
    rightOfWithdrawalDays: 14,
    /** Pro-rata = we refund the unused portion of the period after the 14-day window for monthly/yearly plans. */
    proRated: true,
  },
  /** Governing law + dispute resolution. */
  jurisdiction: {
    law: 'Romanian law',
    courts: 'the competent courts in Romania',
    /** EU online dispute resolution platform — required link for EU traders selling to consumers. */
    odrUrl: 'https://ec.europa.eu/consumers/odr',
    /** Romanian consumer protection authority. */
    consumerAuthority: {
      name: 'Autoritatea Națională pentru Protecția Consumatorilor (ANPC)',
      url: 'https://anpc.ro',
    },
    /** Romanian data-protection authority. */
    dpa: {
      name: 'Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)',
      url: 'https://www.dataprotection.ro',
    },
  },
} as const;

/** Format a date as `9 May 2026` for legal pages. */
export function formatLegalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
