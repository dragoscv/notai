import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Notai mobile shell — Capacitor 6.
 *
 * Two run modes:
 *   1. "Wrapper" mode (default): the native shell loads the production
 *      web app at `server.url`. Fastest to ship, always up-to-date.
 *   2. "Bundled" mode: copy a static export of the web app into
 *      `apps/mobile/www` and unset `server.url` for offline-capable
 *      builds (requires Next.js `output: 'export'`).
 *
 * The webDir is required even in wrapper mode for asset fallbacks and
 * splash screens.
 */
const config: CapacitorConfig = {
  appId: 'app.notai.mobile',
  appName: 'Notai',
  webDir: 'www',
  server: {
    // Switch to your production host on first build.
    url: process.env.NOTAI_MOBILE_URL ?? 'https://notai.ro',
    cleartext: false,
    // Allow Auth.js OAuth redirects to come back to the wrapper.
    allowNavigation: ['accounts.google.com', 'github.com', 'login.microsoftonline.com'],
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#fbfaf5',
  },
};

export default config;
