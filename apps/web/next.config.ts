import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone build keeps the optional self-hosted Docker image small.
  // Vercel ignores this flag.
  output: 'standalone',

  // Next.js 16 — top-level flags
  reactCompiler: true,

  experimental: {
    turbopackFileSystemCacheForDev: true,
    optimizePackageImports: [
      'lucide-react',
      '@notai/ui',
      '@notai/editor',
      'framer-motion',
      'date-fns',
    ],
  },

  transpilePackages: ['@notai/ui', '@notai/editor', '@notai/lib', '@notai/db'],

  // Allow serving the Tauri app to talk to the API cross-origin in dev
  async headers() {
    // Content-Security-Policy:
    //  - default-src 'self' is the safe baseline.
    //  - script-src adds 'unsafe-inline' so Next's hydration runtime works;
    //    'wasm-unsafe-eval' is required by Yjs/PDF.js wasm shims used in
    //    the editor. We do NOT allow 'unsafe-eval'.
    //  - style-src 'unsafe-inline' is needed for Next/Tailwind injected
    //    styles and is broadly accepted as low-risk.
    //  - img-src whitelists our two avatar CDNs + data: for tiny inlined
    //    icons used by lucide.
    //  - connect-src allows our realtime websocket (wss:) and api.resend.com
    //    for the contact form.
    //  - frame-ancestors 'self' replaces the deprecated X-Frame-Options.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
      // Excalidraw 0.18 fetches its custom canvas fonts (Excalifont, Virgil,
      // Cascadia, …) from `https://esm.sh` as a runtime fallback when no
      // `window.EXCALIDRAW_ASSET_PATH` is set. Without esm.sh in font-src the
      // font picker silently does nothing — every choice falls back to the
      // browser default. unpkg/jsdelivr are listed for resilience.
      "font-src 'self' data: https://esm.sh https://unpkg.com https://cdn.jsdelivr.net",
      "connect-src 'self' https: wss:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Origin-Agent-Cluster', value: '?1' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Permissions-Policy',
            // Allow stylus / pen APIs used by Galaxy S Pen on Chromium
            value:
              'accelerometer=(), camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default withSerwist(nextConfig);
