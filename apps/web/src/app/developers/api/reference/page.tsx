import Script from 'next/script';

export const metadata = {
  title: 'Notai API reference',
  description: 'Interactive OpenAPI 3.1 reference for the Notai REST API.',
};

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
