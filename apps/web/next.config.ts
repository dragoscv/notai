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
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // Allow stylus / pen APIs used by Galaxy S Pen on Chromium
            value: 'accelerometer=(), camera=(), microphone=(), geolocation=()',
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
