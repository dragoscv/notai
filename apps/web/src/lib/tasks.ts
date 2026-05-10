/**
 * Pure parser for `[ ] …` task lines extracted from a note's plaintext.
 * Lives in `lib/` (not `server/actions/`) so it can be reused on the
 * client without crossing the server-action boundary.
 *
 * Supported inline metadata (case-insensitive):
 *   @due(YYYY-MM-DD)            — sets the due date
 *   @every(daily|weekly|monthly|weekdays)
 *                                — declares recurrence (semantic only;
 *                                  no scheduler runs server-side yet)
 *   !!high | !!med | !!low      — priority
 */

export type TaskPriority = 'high' | 'med' | 'low';
export type TaskRecurrence = 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;

export interface ParsedTask {
  text: string;
  raw: string;
  dueDate: string | null;
  recurrence: TaskRecurrence;
  priority: TaskPriority | null;
  daysUntil: number | null;
  /** Estimated effort in minutes, parsed from `@est(15m)` / `@est(1h)`. */
  estimateMin: number | null;
}

const TODO_LINE = /^[\s>*-]*\[\s\]\s+(.+?)$/;
const DUE_RE = /@due\((\d{4}-\d{2}-\d{2})\)/i;
const REPEAT_RE = /@(?:every|repeat)\(\s*(daily|weekly|monthly|weekdays)\s*\)/i;
const PRIORITY_RE = /!!(high|med|low)\b/i;
const ESTIMATE_RE = /@est\(\s*(\d+)\s*(m|min|h|hr|hour|hours|minutes)?\s*\)/i;

export const TODO_LINE_GLOBAL = /^[\s>*-]*\[\s\]\s+(.+?)$/gm;

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseTaskLine(raw: string): ParsedTask | null {
  const m = TODO_LINE.exec(raw);
  if (!m) return null;
  const body = (m[1] ?? '').trim();
  if (!body) return null;

  const dueM = DUE_RE.exec(body);
  const repM = REPEAT_RE.exec(body);
  const priM = PRIORITY_RE.exec(body);
  const estM = ESTIMATE_RE.exec(body);

  const dueDate = dueM ? dueM[1]! : null;
  const recurrence = (repM ? repM[1]!.toLowerCase() : null) as TaskRecurrence;
  const priority = (priM ? priM[1]!.toLowerCase() : null) as TaskPriority | null;

  let estimateMin: number | null = null;
  if (estM) {
    const n = Number(estM[1]);
    const unit = (estM[2] ?? 'm').toLowerCase();
    if (Number.isFinite(n) && n > 0) {
      estimateMin = unit.startsWith('h') ? Math.round(n * 60) : Math.round(n);
    }
  }

  const text = body
    .replace(DUE_RE, '')
    .replace(REPEAT_RE, '')
    .replace(PRIORITY_RE, '')
    .replace(ESTIMATE_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  let daysUntil: number | null = null;
  if (dueDate) {
    const today = todayUtcMidnight();
    const target = Date.UTC(
      Number(dueDate.slice(0, 4)),
      Number(dueDate.slice(5, 7)) - 1,
      Number(dueDate.slice(8, 10)),
    );
    daysUntil = Math.round((target - today.getTime()) / 86_400_000);
  }

  return { text, raw, dueDate, recurrence, priority, daysUntil, estimateMin };
}

export function priorityWeight(p: TaskPriority | null): number {
  if (p === 'high') return 0;
  if (p === 'med') return 1;
  if (p === 'low') return 3;
  return 2;
}

/* ------------------------------ Recurrence ------------------------------ */

/** Match a completed task line: `[x]` or `[X]`. Body capture is greedy. */
export const DONE_LINE_GLOBAL = /^([\s>*-]*\[[xX]\]\s+)(.+)$/gm;

/**
 * Compute the next occurrence date (YYYY-MM-DD) for a recurring task,
 * given the previous due date (or "today" if no due date was set).
 * Returns null when the task isn't recurring.
 */
export function nextOccurrence(recurrence: TaskRecurrence, fromIso: string | null): string | null {
  if (!recurrence) return null;
  const base = fromIso
    ? new Date(
        Date.UTC(
          Number(fromIso.slice(0, 4)),
          Number(fromIso.slice(5, 7)) - 1,
          Number(fromIso.slice(8, 10)),
        ),
      )
    : todayUtcMidnight();

  const next = new Date(base);
  if (recurrence === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (recurrence === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (recurrence === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else if (recurrence === 'weekdays') {
    do {
      next.setUTCDate(next.getUTCDate() + 1);
    } while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
  }
  return next.toISOString().slice(0, 10);
}

/** Read the `@due` and `@repeat` markers off any task line (open or done). */
export function readMarkers(body: string): {
  dueDate: string | null;
  recurrence: TaskRecurrence;
} {
  const dueM = DUE_RE.exec(body);
  const repM = REPEAT_RE.exec(body);
  return {
    dueDate: dueM ? dueM[1]! : null,
    recurrence: (repM ? repM[1]!.toLowerCase() : null) as TaskRecurrence,
  };
}

/**
 * Walk a plaintext blob and, for every newly-completed recurring task
 * line, append a fresh open instance with the next due date. Returns
 * the rewritten text and a count of how many instances were rolled.
 *
 * The roll is idempotent: an open task with the same `@repeat` cadence
 * and the next due date already present anywhere in the text is
 * skipped, so re-running on the same input doesn't duplicate.
 */
export function rollRecurringTasks(text: string): { next: string; rolled: number } {
  const lines = text.split('\n');
  const out: string[] = [];
  let rolled = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    out.push(line);
    const doneM = /^([\s>*-]*\[[xX]\]\s+)(.+)$/.exec(line);
    if (!doneM) continue;
    const body = doneM[2]!;
    const { dueDate, recurrence } = readMarkers(body);
    if (!recurrence) continue;
    const nextDue = nextOccurrence(recurrence, dueDate);
    if (!nextDue) continue;

    // Build the new open task: same body, due date replaced (or appended).
    let nextBody: string;
    if (DUE_RE.test(body)) {
      nextBody = body.replace(DUE_RE, `@due(${nextDue})`);
    } else {
      nextBody = `${body.trim()} @due(${nextDue})`;
    }
    const indentMatch = /^([\s>*-]*)/.exec(line);
    const indent = (indentMatch ? indentMatch[1] : '') ?? '';
    const candidate = `${indent}[ ] ${nextBody.trim()}`;

    // Idempotency — don't duplicate if the same next-due open task exists.
    const dup = lines.some((l, j) => {
      if (j === i) return false;
      if (!l.includes('[ ]')) return false;
      const m = readMarkers(l);
      return m.recurrence === recurrence && m.dueDate === nextDue;
    });
    if (dup) continue;

    out.push(candidate);
    rolled += 1;
  }
  return { next: out.join('\n'), rolled };
}
