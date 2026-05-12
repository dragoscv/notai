import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from '@notai/ui/components/theme-provider';
import { Toaster } from '@notai/ui/components/toaster';
import { TooltipProvider } from '@notai/ui/components/tooltip';
import { ConsentProvider } from '@notai/ui/components/consent-provider';
import { CookieConsent } from '@notai/ui/components/cookie-consent';
import { PreferencesApplier } from '@/components/settings/preferences-applier';
import { CapacitorDeepLinkBridge } from '@/components/mobile/capacitor-deep-link-bridge';
import { CapacitorPushBridge } from '@/components/mobile/capacitor-push-bridge';
import { UpgradeModalProvider } from '@/components/upgrade-modal';
import { ConsentAwareAnalytics } from '@/components/analytics/consent-aware-analytics';
import { JsonLd, ORGANIZATION_SCHEMA } from '@/components/seo/json-ld';
import { resolveLocale } from '@/../i18n';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro'),
  title: { default: 'Notai', template: '%s · Notai' },
  description: 'A calm, collaborative notes app with drawing, lists, and sticky notes on desktop.',
  applicationName: 'Notai',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Notai', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' }],
    shortcut: '/icons/icon-128.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf5' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1625' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <JsonLd data={ORGANIZATION_SCHEMA} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <TooltipProvider delayDuration={200}>
              <ConsentProvider>
                <UpgradeModalProvider>
                  <PreferencesApplier />
                  <CapacitorDeepLinkBridge />
                  <CapacitorPushBridge />
                  {children}
                  <CookieConsent />
                  <ConsentAwareAnalytics />
                  <Toaster position="bottom-right" richColors />
                </UpgradeModalProvider>
              </ConsentProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
