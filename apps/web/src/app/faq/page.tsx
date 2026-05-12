import type { Metadata } from 'next';
import { resolveLocale } from '../../../i18n';
import { LegalPage } from '@/components/layout/legal-page';
import { LEGAL } from '@/lib/legal-info';
import { JsonLd, faqSchema } from '@/components/seo/json-ld';
import type { FaqContent } from './_content.types';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Întrebări frecvente' : 'Frequently asked questions',
    description: isRo
      ? 'Răspunsuri la întrebări comune despre Notai — conturi, facturare, confidențialitate, rambursări și cum funcționează sincronizarea local-first.'
      : 'Answers to common questions about Notai — accounts, billing, privacy, refunds, and how the local-first sync works.',
    alternates: { canonical: '/faq' },
  };
}

async function loadContent(): Promise<FaqContent> {
  const locale = await resolveLocale();
  if (locale === 'ro') return (await import('./_content.ro')).content;
  return (await import('./_content.en')).content;
}

export default async function FaqPage() {
  const content = await loadContent();
  return (
    <LegalPage
      title={content.pageTitle}
      subtitle={content.pageSubtitle}
      updated={LEGAL.lastUpdated}
    >
      <JsonLd data={faqSchema(content.schemaItems)} />
      {content.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.items.map((item, i) => (
            <details
              key={i}
              className="not-prose border-border/60 bg-card/40 group mt-3 rounded-xl border p-4 [&_summary]:cursor-pointer"
            >
              <summary className="text-foreground flex items-center justify-between gap-3 text-sm font-medium">
                <span>{item.q}</span>
                <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
              </summary>
              <div className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</div>
            </details>
          ))}
        </section>
      ))}

      <h2>{content.stillStuckTitle}</h2>
      {content.stillStuck}
    </LegalPage>
  );
}
