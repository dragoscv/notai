'use client';

import * as React from 'react';
import { Pause, Play, RotateCcw, Timer, X, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';

const STORAGE_KEY = 'notai:pomodoro-v1';
const FOCUS_MIN = 25;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_MIN = 15;

type Phase = 'focus' | 'short-break' | 'long-break';

interface PomoState {
  phase: Phase;
  // Either running with `endsAt` (epoch ms) or paused with `remaining` (ms).
  endsAt: number | null;
  remaining: number;
  cyclesCompleted: number;
}

function fullMinutesFor(phase: Phase): number {
  if (phase === 'focus') return FOCUS_MIN;
  if (phase === 'short-break') return SHORT_BREAK_MIN;
  return LONG_BREAK_MIN;
}

function readState(): PomoState {
  if (typeof window === 'undefined') {
    return { phase: 'focus', endsAt: null, remaining: FOCUS_MIN * 60 * 1000, cyclesCompleted: 0 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PomoState;
  } catch {
    /* fall through */
  }
  return { phase: 'focus', endsAt: null, remaining: FOCUS_MIN * 60 * 1000, cyclesCompleted: 0 };
}

function writeState(s: PomoState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Floating Pomodoro timer pinned to the bottom-left corner of the app
 * shell. State is persisted to `localStorage` so the timer keeps
 * counting across navigations and refreshes \u2014 we only re-render
 * locally; the actual deadline is `endsAt`.
 */
export function PomodoroTimer() {
  const [state, setState] = React.useState<PomoState>(readState);
  const [open, setOpen] = React.useState<boolean>(false);
  const [now, setNow] = React.useState<number>(() => Date.now());

  const update = React.useCallback((next: PomoState) => {
    setState(next);
    writeState(next);
  }, []);

  const beep = React.useCallback(() => {
    if (typeof Audio === 'undefined') return;
    try {
      const ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 200);
    } catch {
      /* audio is best-effort */
    }
  }, []);

  const handlePhaseEnd = React.useCallback(() => {
    const cycles = state.phase === 'focus' ? state.cyclesCompleted + 1 : state.cyclesCompleted;
    let nextPhase: Phase;
    if (state.phase === 'focus') {
      nextPhase = cycles % 4 === 0 ? 'long-break' : 'short-break';
      toast.success('Focus block done. Take a breather.');
    } else {
      nextPhase = 'focus';
      toast.success('Break over \u2014 back to the work.');
    }
    update({
      phase: nextPhase,
      endsAt: null,
      remaining: fullMinutesFor(nextPhase) * 60 * 1000,
      cyclesCompleted: cycles,
    });
    beep();
  }, [state.phase, state.cyclesCompleted, update, beep]);

  // Tick every 500ms while running so the displayed time updates.
  React.useEffect(() => {
    if (state.endsAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if ((state.endsAt ?? 0) - t <= 0) handlePhaseEnd();
    }, 500);
    return () => clearInterval(id);
  }, [state.endsAt, handlePhaseEnd]);

  const remainingMs = state.endsAt !== null ? Math.max(0, state.endsAt - now) : state.remaining;

  const start = () => {
    const ms = remainingMs > 0 ? remainingMs : fullMinutesFor(state.phase) * 60 * 1000;
    const t = Date.now();
    setNow(t);
    update({ ...state, endsAt: t + ms, remaining: ms });
  };

  const pause = () => {
    if (state.endsAt === null) return;
    const ms = Math.max(0, state.endsAt - Date.now());
    update({ ...state, endsAt: null, remaining: ms });
  };

  const reset = () => {
    update({ phase: 'focus', endsAt: null, remaining: FOCUS_MIN * 60 * 1000, cyclesCompleted: 0 });
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open Pomodoro timer"
        onClick={() => setOpen(true)}
        className="bg-card/90 hover:bg-card text-foreground/80 hover:text-foreground fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-lg backdrop-blur"
      >
        <Timer className="size-3.5" />
        {state.endsAt !== null ? formatRemaining(remainingMs) : 'Pomodoro'}
      </button>
    );
  }

  const phaseLabel =
    state.phase === 'focus'
      ? 'Focus'
      : state.phase === 'short-break'
        ? 'Short break'
        : 'Long break';
  const PhaseIcon = state.phase === 'focus' ? Timer : Coffee;

  return (
    <div className="bg-card/95 fixed bottom-4 left-4 z-40 w-56 rounded-xl border p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <PhaseIcon className="size-3.5" />
          {phaseLabel}
        </div>
        <button
          type="button"
          aria-label="Close timer"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-2 text-center font-serif text-3xl tabular-nums">
        {formatRemaining(remainingMs)}
      </div>
      <div className="text-muted-foreground mt-1 text-center text-[10px] uppercase tracking-wider">
        {state.cyclesCompleted} focus block{state.cyclesCompleted === 1 ? '' : 's'} done
      </div>
      <div className="mt-2 flex items-center gap-1">
        {state.endsAt === null ? (
          <Button size="sm" className="flex-1" onClick={start}>
            <Play className="size-3.5" /> Start
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="flex-1" onClick={pause}>
            <Pause className="size-3.5" /> Pause
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={reset} aria-label="Reset">
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
