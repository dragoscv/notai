/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        // /offline is precached by Next + Serwist (it's a static page).
        // The SW falls back to it when a navigation request can't be
        // satisfied from network or cache.
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
