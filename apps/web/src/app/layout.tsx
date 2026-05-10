import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@notai/ui/components/theme-provider';
import { Toaster } from '@notai/ui/components/toaster';
import { TooltipProvider } from '@notai/ui/components/tooltip';
import { ConsentProvider } from '@notai/ui/components/consent-provider';
import { CookieConsent } from '@notai/ui/components/cookie-consent';
import { PreferencesApplier } from '@/components/settings/preferences-applier';
import { CapacitorDeepLinkBridge } from '@/components/mobile/capacitor-deep-link-bridge';
import { UpgradeModalProvider } from '@/components/upgrade-modal';
import { ConsentAwareAnalytics } from '@/components/analytics/consent-aware-analytics';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Notai', template: '%s · Notai' },
  description: 'A calm, collaborative notes app with drawing, lists, and sticky notes on desktop.',
  applicationName: 'Notai',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Notai', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: '/icons/icon.svg',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <ConsentProvider>
              <UpgradeModalProvider>
                <PreferencesApplier />
                <CapacitorDeepLinkBridge />
                {children}
                <CookieConsent />
                <ConsentAwareAnalytics />
                <Toaster position="bottom-right" richColors />
              </UpgradeModalProvider>
            </ConsentProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
