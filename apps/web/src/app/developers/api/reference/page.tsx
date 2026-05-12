import Script from 'next/script';
import type { Metadata } from 'next';
import { resolveLocale } from '../../../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const isRo = locale === 'ro';
  return {
    title: isRo ? 'Referință API Notai' : 'Notai API reference',
    description: isRo
      ? 'Referință OpenAPI 3.1 interactivă pentru API-ul REST Notai.'
      : 'Interactive OpenAPI 3.1 reference for the Notai REST API.',
  };
}

export default function ApiReferencePage() {
  return (
    <>
      {/* Scalar API Reference renders the spec into the element below. */}
      <div
        id="api-reference"
        data-url="/api/v1/openapi"
        data-configuration='{"theme":"default","hideDownloadButton":false,"layout":"modern"}'
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        strategy="afterInteractive"
      />
    </>
  );
}
