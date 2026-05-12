'use client';

import * as React from 'react';
import { Cookie, Settings2, X } from 'lucide-react';
import { Button } from './button';
import { Switch } from './switch';
import { Label } from './label';
import { useConsent, type ConsentState } from './consent-provider';
import { cn } from '@notai/lib/utils';

export interface CookieConsentStrings {
  ariaRegion: string;
  bannerTitle: string;
  /** Use `{link}` placeholder where the link to /cookies should appear. */
  bannerBody: string;
  bannerBodyLink: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  settingsTitle: string;
  settingsDescription: string;
  closeAriaLabel: string;
  /** Built into aria-label like "{prefix} {category} {suffix}". */
  toggleAriaPrefix: string;
  toggleAriaSuffix: string;
  necessary: string;
  necessaryDesc: string;
  preferences: string;
  preferencesDesc: string;
  analytics: string;
  analyticsDesc: string;
  marketing: string;
  marketingDesc: string;
  saveChoices: string;
}

const DEFAULT_STRINGS: CookieConsentStrings = {
  ariaRegion: 'Cookie consent',
  bannerTitle: 'We respect your data.',
  bannerBody:
    'Notai uses cookies that are strictly necessary to sign you in and keep the app working. Optional cookies for preferences and anonymous analytics help us improve. You can change your mind anytime from the {link} page.',
  bannerBodyLink: 'Cookie settings',
  acceptAll: 'Accept all',
  rejectAll: 'Reject optional',
  customize: 'Customize',
  settingsTitle: 'Cookie settings',
  settingsDescription:
    'Choose which optional cookies Notai may use. Your choice is saved on this device for 12 months.',
  closeAriaLabel: 'Close cookie settings',
  toggleAriaPrefix: 'Toggle',
  toggleAriaSuffix: 'cookies',
  necessary: 'Strictly necessary',
  necessaryDesc:
    'Required for sign-in, security, and remembering your consent choice. These cookies cannot be turned off.',
  preferences: 'Preferences',
  preferencesDesc:
    'Remember your theme, language, and editor width across visits. No personal data leaves your device.',
  analytics: 'Analytics',
  analyticsDesc:
    'Anonymous, aggregated usage statistics so we can understand which features matter and where the app gets stuck.',
  marketing: 'Marketing',
  marketingDesc:
    'Currently unused — Notai has no advertising or third-party trackers. Reserved in case we add a referral program in the future.',
  saveChoices: 'Save my choices',
};

function buildCategories(s: CookieConsentStrings): Array<{
  key: keyof ConsentState;
  label: string;
  description: string;
  locked?: boolean;
}> {
  return [
    { key: 'necessary', label: s.necessary, description: s.necessaryDesc, locked: true },
    { key: 'preferences', label: s.preferences, description: s.preferencesDesc },
    { key: 'analytics', label: s.analytics, description: s.analyticsDesc },
    { key: 'marketing', label: s.marketing, description: s.marketingDesc },
  ];
}

export function CookieConsent({
  strings = DEFAULT_STRINGS,
}: { strings?: CookieConsentStrings } = {}) {
  const { loading, decided, settingsOpen, openSettings } = useConsent();

  if (loading) return null;
  if (decided && !settingsOpen) return null;
  if (settingsOpen) return <CookieSettingsDialog strings={strings} />;

  return <CookieBanner onCustomize={openSettings} strings={strings} />;
}

function CookieBanner({
  onCustomize,
  strings,
}: {
  onCustomize: () => void;
  strings: CookieConsentStrings;
}) {
  const { acceptAll, rejectAll } = useConsent();

  // Render `bannerBody` and replace `{link}` with the styled <a>.
  const parts = strings.bannerBody.split('{link}');

  return (
    <div
      role="region"
      aria-label={strings.ariaRegion}
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
            <p className="font-medium">{strings.bannerTitle}</p>
            <p className="text-muted-foreground">
              {parts[0]}
              <a className="underline" href="/cookies">
                {strings.bannerBodyLink}
              </a>
              {parts[1] ?? ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCustomize} className="gap-2">
            <Settings2 className="size-4" aria-hidden />
            {strings.customize}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={rejectAll}>
            {strings.rejectAll}
          </Button>
          <Button type="button" size="sm" onClick={acceptAll}>
            {strings.acceptAll}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CookieSettingsDialog({ strings }: { strings: CookieConsentStrings }) {
  const { consent, save, closeSettings, acceptAll, rejectAll } = useConsent();
  const [draft, setDraft] = React.useState<ConsentState>(consent);

  React.useEffect(() => {
    setDraft(consent);
  }, [consent]);

  const categories = buildCategories(strings);

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
              {strings.settingsTitle}
            </h2>
            <p id="cookie-settings-desc" className="text-muted-foreground mt-1 text-sm">
              {strings.settingsDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
            aria-label={strings.closeAriaLabel}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="-mx-1 flex flex-col gap-3 overflow-y-auto px-1">
          {categories.map((cat) => (
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
                aria-label={`${strings.toggleAriaPrefix} ${cat.label.toLowerCase()} ${strings.toggleAriaSuffix}`}
              />
            </div>
          ))}
        </div>

        <div className="border-border/60 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={rejectAll}>
              {strings.rejectAll}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={acceptAll}>
              {strings.acceptAll}
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => save(draft)}>
            {strings.saveChoices}
          </Button>
        </div>
      </div>
    </div>
  );
}
