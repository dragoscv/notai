'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface CapacitorAppApi {
  addListener: (
    event: 'appUrlOpen',
    cb: (data: { url: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: { App?: CapacitorAppApi };
  };
}

/**
 * Listens for native deep links from the iOS Action Extension
 * (`notai://quick-capture?shared=...`) and pushes them into the
 * Next.js router. Android's share sheet already targets the
 * web URL directly via MainActivity.java, so this is mostly an
 * iOS code path.
 *
 * No-ops outside Capacitor.
 */
export function CapacitorDeepLinkBridge() {
  const router = useRouter();
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const cap = (window as unknown as CapacitorWindow).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const App = cap.Plugins?.App;
    if (!App) return;
    let unsub: (() => Promise<void>) | null = null;
    void App.addListener('appUrlOpen', (data) => {
      try {
        const u = new URL(data.url);
        // notai://quick-capture?shared=... → /app/quick-capture?shared=...
        if (u.protocol === 'notai:') {
          const path = `/app/${u.host}${u.pathname}${u.search}`;
          router.push(path);
        } else if (u.hostname === 'notai.app' || u.hostname.endsWith('.notai.app')) {
          router.push(`${u.pathname}${u.search}`);
        }
      } catch {
        /* malformed URL, ignore */
      }
    }).then((handle) => {
      unsub = () => handle.remove();
    });
    return () => {
      void unsub?.();
    };
  }, [router]);
  return null;
}
