/**
 * Tiny IANA-timezone helpers used by the daily-note feature.
 * Centralised so the page route, server action, and cron all agree
 * on what "today" means for a user.
 */

/**
 * Returns the user's current local calendar date as `YYYY-MM-DD`.
 * Falls back to UTC if the timezone is missing or invalid.
 */
export function localDateKey(timezone: string | null | undefined, when: Date = new Date()): string {
  const tz = (timezone ?? '').trim();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(when);
    const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    // Bad timezone — degrade to UTC so the cron never crashes.
    const u = new Date(when.getTime());
    return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
  }
}

/** "Daily — YYYY-MM-DD" — the canonical title used as the lookup key. */
export function dailyNoteTitle(dateKey: string): string {
  return `Daily — ${dateKey}`;
}
