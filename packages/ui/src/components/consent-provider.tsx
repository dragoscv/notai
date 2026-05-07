'use client';

import * as React from 'react';

export type ConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing';

export type ConsentState = Record<ConsentCategory, boolean>;

export const CONSENT_COOKIE = 'notai_consent';
export const CONSENT_VERSION = 1;

const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

type StoredConsent = {
  v: number;
  t: number;
  c: ConsentState;
};

interface ConsentContextValue {
  /** True until we've checked storage on the client. */
  loading: boolean;
  /** True if the user has already made a choice. */
  decided: boolean;
  consent: ConsentState;
  /** Persist the given consent and close the banner. */
  save: (c: ConsentState) => void;
  /** Accept every category. */
  acceptAll: () => void;
  /** Reject every non-essential category. */
  rejectAll: () => void;
  /** Re-open the customization dialog (used by /cookies page and footer). */
  openSettings: () => void;
  settingsOpen: boolean;
  closeSettings: () => void;
}

const ConsentContext = React.createContext<ConsentContextValue | null>(null);

function readConsent(): StoredConsent | null {
  if (typeof document === 'undefined') return null;
  // Try cookie first (works for SSR-readable preferences), then localStorage.
  const cookieMatch = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  const raw = cookieMatch
    ? decodeURIComponent(cookieMatch.split('=')[1] ?? '')
    : window.localStorage.getItem(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(c: ConsentState) {
  if (typeof document === 'undefined') return;
  const payload: StoredConsent = { v: CONSENT_VERSION, t: Date.now(), c };
  const value = encodeURIComponent(JSON.stringify(payload));
  // Persist for 12 months. SameSite=Lax so it is sent on top-level navigation.
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${oneYear}; path=/; SameSite=Lax`;
  try {
    window.localStorage.setItem(CONSENT_COOKIE, JSON.stringify(payload));
  } catch {
    /* storage may be unavailable in private mode */
  }
  // Notify any listeners (e.g. analytics loaders) that consent changed.
  window.dispatchEvent(new CustomEvent('notai:consent-changed', { detail: c }));
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [decided, setDecided] = React.useState(false);
  const [consent, setConsent] = React.useState<ConsentState>(DEFAULT_CONSENT);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = readConsent();
    if (stored) {
      setConsent({ ...DEFAULT_CONSENT, ...stored.c, necessary: true });
      setDecided(true);
    }
    setLoading(false);
  }, []);

  const save = React.useCallback((c: ConsentState) => {
    const next = { ...c, necessary: true };
    writeConsent(next);
    setConsent(next);
    setDecided(true);
    setSettingsOpen(false);
  }, []);

  const acceptAll = React.useCallback(() => {
    save({ necessary: true, preferences: true, analytics: true, marketing: true });
  }, [save]);

  const rejectAll = React.useCallback(() => {
    save({ necessary: true, preferences: false, analytics: false, marketing: false });
  }, [save]);

  const value: ConsentContextValue = {
    loading,
    decided,
    consent,
    save,
    acceptAll,
    rejectAll,
    openSettings: () => setSettingsOpen(true),
    settingsOpen,
    closeSettings: () => setSettingsOpen(false),
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = React.useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used inside <ConsentProvider>');
  return ctx;
}
