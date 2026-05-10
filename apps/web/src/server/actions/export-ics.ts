'use server';

/**
 * Calendar export. Scans the user's notes for ISO-style dates
 * (YYYY-MM-DD, optional HH:MM) in the title or plaintext and emits a
 * minimal RFC 5545 .ics file. Each match becomes a VEVENT pointing
 * back at the note URL via DESCRIPTION.
 *
 * This is heuristic: anything that looks like a date in the body of a
 * note shows up. We dedupe per (noteId, dateKey).
 */

import { auth } from '@/auth';
import { db, notes, eq, isNull, and } from '@notai/db';

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/g;

interface CalEvent {
  uid: string;
  start: Date;
  hasTime: boolean;
  summary: string;
  noteId: string;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function fmtUTC(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function fmtAllDay(d: Date): string {
  return d.getUTCFullYear().toString() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function fold(line: string): string {
  // ICS lines max 75 chars; long lines fold with CRLF + space.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) {
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
  }
  return parts.join('\r\n');
}

export async function exportCalendarIcs(originUrl: string): Promise<{
  filename: string;
  content: string;
  eventCount: number;
}> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sign in required');

  const rows = await db
    .select({ id: notes.id, title: notes.title, plaintext: notes.plaintext })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    .limit(2000);

  const events: CalEvent[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const haystack = `${r.title}\n${r.plaintext ?? ''}`;
    let m: RegExpExecArray | null;
    DATE_RE.lastIndex = 0;
    while ((m = DATE_RE.exec(haystack)) !== null) {
      const [, y, mo, d, hh, mm] = m;
      const year = Number(y);
      if (year < 1970 || year > 2100) continue;
      const date = new Date(
        Date.UTC(year, Number(mo) - 1, Number(d), hh ? Number(hh) : 0, mm ? Number(mm) : 0),
      );
      if (Number.isNaN(date.getTime())) continue;
      const key = `${r.id}:${date.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        uid: `${r.id}-${date.getTime()}@notai`,
        start: date,
        hasTime: Boolean(hh),
        summary: r.title || 'Untitled note',
        noteId: r.id,
      });
    }
  }

  const now = fmtUTC(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Notai//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(fold(`UID:${ev.uid}`));
    lines.push(`DTSTAMP:${now}`);
    if (ev.hasTime) {
      lines.push(`DTSTART:${fmtUTC(ev.start)}`);
      lines.push(`DTEND:${fmtUTC(new Date(ev.start.getTime() + 60 * 60 * 1000))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${fmtAllDay(ev.start)}`);
    }
    lines.push(fold(`SUMMARY:${escapeICS(ev.summary)}`));
    const url = `${originUrl.replace(/\/+$/, '')}/app/n/${ev.noteId}`;
    lines.push(fold(`DESCRIPTION:${escapeICS(`Notai note: ${url}`)}`));
    lines.push(fold(`URL:${url}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  return {
    filename: `notai-calendar-${new Date().toISOString().slice(0, 10)}.ics`,
    content,
    eventCount: events.length,
  };
}
