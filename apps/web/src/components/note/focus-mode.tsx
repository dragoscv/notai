'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Focus, Pause, Play, RotateCcw, X, Coffee, Brain } from 'lucide-react';
import { cn } from '@notai/lib/utils';

type Phase = 'focus' | 'break' | 'idle';

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'notai:focus-mode';

interface PersistedState {
  active: boolean;
  pomodoro: {
    enabled: boolean;
    phase: Phase;
    endsAt: number | null;
    paused: boolean;
    remainingMs: number | null;
  };
}

const DEFAULT_STATE: PersistedState = {
  active: false,
  pomodoro: { enabled: false, phase: 'idle', endsAt: null, paused: false, remainingMs: null },
};

/**
 * Distraction-free writing layer.
 *
 * - `F` toggles focus mode globally (skipped while typing in inputs).
 * - When active, sets `data-focus="true"` on the document root so the
 *   sidebar/header CSS hides itself (no React tree changes needed).
 * - Optional 25/5 Pomodoro overlay sits in the bottom-right corner; the
 *   timer state persists in localStorage so a reload doesn't reset it.
 *
 * The component renders no chrome at all when `active === false` —
 * everything is on-demand and toggled by keyboard.
 */
export function FocusMode() {
  const t = useTranslations('editor.focusMode');
  const [state, setState] = React.useState<PersistedState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Keep <html data-focus="…"> in sync.
  React.useEffect(() => {
    const root = document.documentElement;
    if (state.active) root.setAttribute('data-focus', 'true');
    else root.removeAttribute('data-focus');
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota — ignore */
    }
    return () => root.removeAttribute('data-focus');
  }, [state]);

  // Global F-key toggle. Ignored while typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (
        t.isContentEditable ||
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT'
      ) {
        return;
      }
      e.preventDefault();
      setState((s) => ({ ...s, active: !s.active }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Pomodoro tick. Re-render every second when a timer is running. We
  // store `now` in state (instead of forcing a re-render with a reducer)
  // so the value used to compute the remaining time is captured at
  // render-tick time and the render itself stays pure.
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (!state.pomodoro.enabled || state.pomodoro.paused || state.pomodoro.phase === 'idle') {
      return;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [state.pomodoro.enabled, state.pomodoro.paused, state.pomodoro.phase]);

  // When the timer hits zero, swap phases automatically.
  React.useEffect(() => {
    if (!state.pomodoro.enabled || state.pomodoro.paused) return;
    if (state.pomodoro.endsAt == null) return;
    const remaining = state.pomodoro.endsAt - now;
    if (remaining > 0) return;
    const nextPhase: Phase = state.pomodoro.phase === 'focus' ? 'break' : 'focus';
    const dur = nextPhase === 'focus' ? FOCUS_MS : BREAK_MS;
    setState((s) => ({
      ...s,
      pomodoro: {
        ...s.pomodoro,
        phase: nextPhase,
        endsAt: Date.now() + dur,
        paused: false,
        remainingMs: null,
      },
    }));
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(nextPhase === 'focus' ? t('notification.focus') : t('notification.break'));
      }
    } catch {
      /* ignore */
    }
  }, [
    now,
    state.pomodoro.enabled,
    state.pomodoro.paused,
    state.pomodoro.endsAt,
    state.pomodoro.phase,
  ]);

  if (!state.active) return null;

  const remainingMs =
    state.pomodoro.endsAt == null
      ? null
      : state.pomodoro.paused
        ? state.pomodoro.remainingMs
        : Math.max(0, state.pomodoro.endsAt - now);

  const exit = () => setState((s) => ({ ...s, active: false }));

  const togglePomodoro = () => {
    setState((s) => {
      const enabling = !s.pomodoro.enabled;
      if (enabling) {
        return {
          ...s,
          pomodoro: {
            enabled: true,
            phase: 'focus',
            endsAt: Date.now() + FOCUS_MS,
            paused: false,
            remainingMs: null,
          },
        };
      }
      return { ...s, pomodoro: DEFAULT_STATE.pomodoro };
    });
  };

  const togglePause = () => {
    setState((s) => {
      if (!s.pomodoro.enabled || s.pomodoro.endsAt == null) return s;
      if (s.pomodoro.paused) {
        const r = s.pomodoro.remainingMs ?? 0;
        return {
          ...s,
          pomodoro: { ...s.pomodoro, paused: false, endsAt: Date.now() + r, remainingMs: null },
        };
      }
      const r = Math.max(0, s.pomodoro.endsAt - Date.now());
      return { ...s, pomodoro: { ...s.pomodoro, paused: true, remainingMs: r } };
    });
  };

  const reset = () => {
    setState((s) => ({
      ...s,
      pomodoro: {
        ...s.pomodoro,
        phase: 'focus',
        endsAt: Date.now() + FOCUS_MS,
        paused: false,
        remainingMs: null,
      },
    }));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* Subtle vignette so the eye lands on the editor */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 50%, transparent 50%, color-mix(in oklab, var(--background) 60%, transparent) 100%)',
        }}
      />
      <div className="bg-background/85 pointer-events-auto absolute right-4 top-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-lg backdrop-blur">
        <Focus className="text-primary size-3.5" />
        <span className="font-medium">{t('label')}</span>
        <kbd className="bg-muted rounded border px-1 font-mono text-[10px]">F</kbd>
        <button
          type="button"
          onClick={exit}
          className="hover:bg-muted -mr-1 ml-1 grid size-6 place-items-center rounded-full"
          aria-label={t('exit')}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col items-end gap-2">
        {state.pomodoro.enabled && remainingMs != null && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-2 text-sm shadow-lg backdrop-blur',
              state.pomodoro.phase === 'focus'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            )}
          >
            {state.pomodoro.phase === 'focus' ? (
              <Brain className="size-4" />
            ) : (
              <Coffee className="size-4" />
            )}
            <span className="font-mono text-base font-medium tabular-nums">{fmt(remainingMs)}</span>
            <button
              type="button"
              onClick={togglePause}
              className="hover:bg-background/30 grid size-6 place-items-center rounded-full"
              aria-label={state.pomodoro.paused ? t('resume') : t('pause')}
            >
              {state.pomodoro.paused ? (
                <Play className="size-3.5" />
              ) : (
                <Pause className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              className="hover:bg-background/30 grid size-6 place-items-center rounded-full"
              aria-label={t('resetTimer')}
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={togglePomodoro}
          className="bg-background/85 hover:bg-background flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-lg backdrop-blur"
        >
          <Brain className="size-3.5" />
          {state.pomodoro.enabled ? t('stopPomodoro') : t('startPomodoro')}
        </button>
      </div>
    </div>
  );
}

function fmt(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
