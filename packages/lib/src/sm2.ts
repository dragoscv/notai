/**
 * SM-2 spaced-repetition scheduler (SuperMemo 2).
 *
 * Quality is graded 0-5:
 *   0-2 = fail (resets repetitions, schedules tomorrow, increments lapses)
 *   3-5 = pass (advances interval per SM-2)
 */
export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface Sm2Next extends Sm2State {
  dueAt: Date;
}

const MIN_EF = 1.3;

export function scheduleNext(state: Sm2State, quality: number, now: Date = new Date()): Sm2Next {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easeFactor, intervalDays, repetitions, lapses } = state;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < MIN_EF) easeFactor = MIN_EF;

  const dueAt = new Date(now.getTime() + intervalDays * 86_400_000);
  return { easeFactor, intervalDays, repetitions, lapses, dueAt };
}
