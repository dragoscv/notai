'use client';

import * as React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Kbd } from '@notai/ui/components/kbd';

const STORAGE_KEY = 'notai:onboarding:completed-v1';

interface Step {
  title: string;
  body: React.ReactNode;
}

function useSteps(): Step[] {
  const t = useTranslations('appShell.onboarding');
  return React.useMemo<Step[]>(
    () => [
      {
        title: t('step1Title'),
        body: <p>{t('step1Body')}</p>,
      },
      {
        title: t('step2Title'),
        body: (
          <p>
            {t('step2BodyPrefix')}
            <Kbd>mod+shift+n</Kbd>
            {t('step2BodySuffix')}
          </p>
        ),
      },
      {
        title: t('step3Title'),
        body: (
          <p>
            {t('step3BodyPrefix')}
            <Kbd>mod+j</Kbd>
            {t('step3BodySuffix')}
          </p>
        ),
      },
      {
        title: t('step4Title'),
        body: (
          <p>
            {t('step4BodyPrefix')}
            <Kbd>mod+k</Kbd>
            {t('step4BodyMiddle')}
          </p>
        ),
      },
      {
        title: t('step5Title'),
        body: <p>{t('step5Body')}</p>,
      },
    ],
    [t],
  );
}

export function OnboardingTour() {
  const t = useTranslations('appShell.onboarding');
  const steps = useSteps();
  const [step, setStep] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      return;
    }
    const handle = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(handle);
  }, []);

  const finish = React.useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  if (!open) return null;
  const current = steps[step]!;
  const isLast = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t('skipAria')}
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={finish}
      />
      <div className="bg-card relative z-10 w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
        <div className="from-primary/15 via-primary/5 to-background relative overflow-hidden bg-gradient-to-br p-6">
          <div className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-lg shadow">
            <Sparkles className="size-4" />
          </div>
          <button
            type="button"
            aria-label={t('skipAria')}
            onClick={finish}
            className="text-muted-foreground hover:text-foreground absolute right-3 top-3"
          >
            <X className="size-4" />
          </button>
          <h2
            id="onboarding-title"
            className="mt-4 font-serif text-xl font-semibold tracking-tight"
          >
            {current.title}
          </h2>
        </div>
        <div className="text-muted-foreground space-y-3 px-6 py-5 text-sm leading-relaxed">
          {current.body}
        </div>
        <div className="bg-muted/30 flex items-center justify-between gap-3 border-t px-6 py-3">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  'size-1.5 rounded-full ' +
                  (i === step
                    ? 'bg-primary'
                    : i < step
                      ? 'bg-primary/40'
                      : 'bg-muted-foreground/20')
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={finish}>
              {t('skip')}
            </Button>
            <Button size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))}>
              {isLast ? (
                t('getStarted')
              ) : (
                <>
                  {t('next')} <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
