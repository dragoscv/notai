import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sticky' };

// Sticky pages sit under the root layout (no sidebar, no toaster).
export default function StickyLayout({ children }: { children: React.ReactNode }) {
    return <div className="min-h-dvh">{children}</div>;
}
