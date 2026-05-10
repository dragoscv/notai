'use client';

import * as React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Kbd } from '@notai/ui/components/kbd';

const STORAGE_KEY = 'notai:onboarding:completed-v1';

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Notai \u2728',
    body: (
      <p>
        Notai is an ADHD-friendly notebook. Quick capture, infinite canvas, AI that helps you find
        what you wrote three weeks ago. This is a 30-second tour \u2014 you can skip any time.
      </p>
    ),
  },
  {
    title: 'Capture anything in 2 keystrokes',
    body: (
      <p>
        Press <Kbd>mod+shift+n</Kbd> from anywhere to drop a note into your inbox without breaking
        flow. The AI will suggest a folder once you\u2019ve written a few notes.
      </p>
    ),
  },
  {
    title: 'Today\u2019s daily note',
    body: (
      <p>
        Press <Kbd>mod+j</Kbd> to jump to today\u2019s daily note. We auto-create one each day so
        there\u2019s never a blank page when an idea strikes.
      </p>
    ),
  },
  {
    title: 'Ask your notes',
    body: (
      <p>
        The Ask page (<Kbd>mod+k</Kbd> \u2192 \u201cAsk\u201d) runs semantic search across
        everything you\u2019ve written and answers in your own words. Bring your own API key in
        Settings.
      </p>
    ),
  },
  {
    title: 'Make it yours',
    body: (
      <p>
        Settings \u2192 Appearance lets you swap themes, switch on a dyslexia-friendly font, and
        crank up contrast. Settings \u2192 Account exports everything as a .zip of markdown files
        \u2014 your notes, your data.
      </p>
    ),
  },
];

/**
 * Lightweight 5-step welcome overlay shown the first time a user lands
 * on the app shell. Skipped on subsequent loads via a localStorage
 * flag. Pure CSS modal \u2014 no portal so it lives in the same paint as
 * the page underneath.
 */
export function OnboardingTour() {
  const [step, setStep] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      return;
    }
    // Wait a beat so the user sees the app render first.
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
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
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Skip tour"
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
            aria-label="Skip tour"
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
            {STEPS.map((_, i) => (
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
              Skip
            </Button>
            <Button size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))}>
              {isLast ? (
                'Get started'
              ) : (
                <>
                  Next <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
