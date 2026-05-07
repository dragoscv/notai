import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

// Settings window (desktop-only). No sidebar or toaster chrome.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <div className="min-h-dvh bg-background">{children}</div>;
}
