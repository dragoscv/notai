'use client';

import * as React from 'react';
import Script from 'next/script';
import { useConsent } from '@notai/ui/components/consent-provider';

/**
 * Loads Google Analytics 4 + Meta Pixel only after the user grants the
 * matching consent category (analytics / marketing). Consent flips
 * trigger a re-render so scripts mount/unmount in real time.
 *
 * Configure via env vars (set as NEXT_PUBLIC_… so the values reach the
 * client bundle):
 *   NEXT_PUBLIC_GA4_ID
 *   NEXT_PUBLIC_META_PIXEL_ID
 *
 * Both are optional — set them in Vercel when you're ready to enable
 * tracking. Without an ID, the script tag is not emitted.
 */
export function ConsentAwareAnalytics() {
  const { decided, consent } = useConsent();
  if (!decided) return null;

  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  const metaId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <>
      {consent.analytics && gaId ? (
        <>
          <Script
            id="ga4-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      ) : null}

      {consent.marketing && metaId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaId}');fbq('track','PageView');`}
        </Script>
      ) : null}
    </>
  );
}
