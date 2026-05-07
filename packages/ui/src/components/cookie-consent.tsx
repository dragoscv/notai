'use client';

import * as React from 'react';
import { Cookie, Settings2, X } from 'lucide-react';
import { Button } from './button';
import { Switch } from './switch';
import { Label } from './label';
import { useConsent, type ConsentState } from './consent-provider';
import { cn } from '@notai/lib/utils';

const CATEGORIES: Array<{
  key: keyof ConsentState;
  label: string;
  description: string;
  locked?: boolean;
}> = [
  {
    key: 'necessary',
    label: 'Strictly necessary',
    description:
      'Required for sign-in, security, and remembering your consent choice. These cookies cannot be turned off.',
    locked: true,
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description:
      'Remember your theme, language, and editor width across visits. No personal data leaves your device.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Anonymous, aggregated usage statistics so we can understand which features matter and where the app gets stuck.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      'Currently unused — Notai has no advertising or third-party trackers. Reserved in case we add a referral program in the future.',
  },
];

export function CookieConsent() {
  const { loading, decided, settingsOpen, openSettings } = useConsent();

  // Hide on the first paint until we know whether the user already decided.
  if (loading) return null;
  // Banner shows on first visit; settings dialog can be re-opened anytime.
  if (decided && !settingsOpen) return null;
  if (settingsOpen) return <CookieSettingsDialog />;

  return <CookieBanner onCustomize={openSettings} />;
}

function CookieBanner({ onCustomize }: { onCustomize: () => void }) {
  const { acceptAll, rejectAll } = useConsent();

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="border-border/70 bg-background/95 mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="bg-primary/15 text-primary grid size-9 shrink-0 place-items-center rounded-full"
          >
            <Cookie className="size-4" />
          </span>
          <div className="text-foreground min-w-0 flex-1 text-sm leading-relaxed">
            <p className="font-medium">We respect your data.</p>
            <p className="text-muted-foreground">
              Notai uses cookies that are strictly necessary to sign you in and keep the app
              working. Optional cookies for preferences and anonymous analytics help us improve. You
              can change your mind anytime from the{' '}
              <a className="underline" href="/cookies">
                Cookie settings
              </a>{' '}
              page.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCustomize} className="gap-2">
            <Settings2 className="size-4" aria-hidden />
            Customize
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={rejectAll}>
            Reject optional
          </Button>
          <Button type="button" size="sm" onClick={acceptAll}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}

function CookieSettingsDialog() {
  const { consent, save, closeSettings, acceptAll, rejectAll } = useConsent();
  const [draft, setDraft] = React.useState<ConsentState>(consent);

  React.useEffect(() => {
    setDraft(consent);
  }, [consent]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-settings-title"
      aria-describedby="cookie-settings-desc"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="border-border/70 bg-background relative flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-2xl border p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="cookie-settings-title" className="text-lg font-semibold tracking-tight">
              Cookie settings
            </h2>
            <p id="cookie-settings-desc" className="text-muted-foreground mt-1 text-sm">
              Choose which optional cookies Notai may use. Your choice is saved on this device for
              12 months.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
            aria-label="Close cookie settings"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="-mx-1 flex flex-col gap-3 overflow-y-auto px-1">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              className={cn(
                'border-border/60 bg-card/50 flex items-start justify-between gap-4 rounded-xl border p-3',
              )}
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor={`consent-${cat.key}`} className="text-sm font-medium">
                  {cat.label}
                </Label>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {cat.description}
                </p>
              </div>
              <Switch
                id={`consent-${cat.key}`}
                checked={draft[cat.key]}
                disabled={cat.locked}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, [cat.key]: v }))}
                aria-label={`Toggle ${cat.label.toLowerCase()} cookies`}
              />
            </div>
          ))}
        </div>

        <div className="border-border/60 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={rejectAll}>
              Reject optional
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={acceptAll}>
              Accept all
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => save(draft)}>
            Save my choices
          </Button>
        </div>
      </div>
    </div>
  );
}
