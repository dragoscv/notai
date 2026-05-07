import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Lora } from 'next/font/google';
import { ThemeProvider } from '@notai/ui/components/theme-provider';
import { Toaster } from '@notai/ui/components/toaster';
import { TooltipProvider } from '@notai/ui/components/tooltip';
import { PreferencesApplier } from '@/components/settings/preferences-applier';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const lora = Lora({ variable: '--font-lora', subsets: ['latin'] });

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} font-sans antialiased`}
            >
                <ThemeProvider>
                    <TooltipProvider delayDuration={200}>
                        <PreferencesApplier />
                        {children}
                        <Toaster position="bottom-right" richColors />
                    </TooltipProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
