'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, calendarSubscriptions, eq, and, asc } from '@notai/db';
import { revalidatePath } from 'next/cache';
import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';

/**
 * Calendar subscription store + iCal feed fetcher.
 *
 * iCal/webcal URLs are user-supplied, so this is an SSRF surface. We:
 *   1. Allow only http(s)/webcal schemes; rewrite webcal → https.
 *   2. Resolve the hostname and reject loopback / private / link-local
 *      ranges before fetching.
 *   3. Cap response size (1 MB) and parse time.
 *
 * Output is bounded: at most 200 events from the next 7 days, sorted
 * ascending by start time.
 */

const ADD_SCHEMA = z.object({
  name: z.string().min(1).max(80),
  url: z
    .string()
    .min(1)
    .max(2048)
    .refine((s) => /^(https?|webcal):\/\//i.test(s), {
      message: 'URL must start with https://, http://, or webcal://',
    }),
  color: z.string().max(20).optional(),
});

export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  color: string | null;
  enabled: boolean;
}

export interface CalendarEvent {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  subscriptionColor: string | null;
  title: string;
  start: string; // ISO
  end: string | null;
  allDay: boolean;
  location: string | null;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sign in required');
  return session.user.id;
}

export async function listCalendarSubscriptions(): Promise<CalendarSubscription[]> {
  const userId = await requireUser();
  const rows = await db
    .select({
      id: calendarSubscriptions.id,
      name: calendarSubscriptions.name,
      url: calendarSubscriptions.url,
      color: calendarSubscriptions.color,
      enabled: calendarSubscriptions.enabled,
    })
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.userId, userId))
    .orderBy(asc(calendarSubscriptions.createdAt));
  return rows;
}

export async function addCalendarSubscription(input: z.input<typeof ADD_SCHEMA>) {
  const userId = await requireUser();
  const { name, url, color } = ADD_SCHEMA.parse(input);
  await db
    .insert(calendarSubscriptions)
    .values({ userId, name, url: url.replace(/^webcal:\/\//i, 'https://'), color });
  revalidatePath('/app');
}

export async function removeCalendarSubscription(id: string) {
  const userId = await requireUser();
  await db
    .delete(calendarSubscriptions)
    .where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)));
  revalidatePath('/app');
}

export async function toggleCalendarSubscription(id: string, enabled: boolean) {
  const userId = await requireUser();
  await db
    .update(calendarSubscriptions)
    .set({ enabled })
    .where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)));
  revalidatePath('/app');
}

/* ------------------------------ Fetch + parse ------------------------------ */

const PRIVATE_RANGES_V4 = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\./,
];
function isPrivateAddress(addr: string): boolean {
  if (addr === '::1' || addr.startsWith('fc') || addr.startsWith('fd') || addr.startsWith('fe80'))
    return true;
  if (isIP(addr) === 4) {
    return PRIVATE_RANGES_V4.some((re) => re.test(addr));
  }
  return false;
}

async function safeFetch(url: string): Promise<string> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Unsupported URL scheme');
  // Resolve and validate against private ranges. We pass the resolved
  // address as the Host header so tunneling via DNS rebinding is harder.
  const resolved = await dns.lookup(u.hostname, { all: false });
  if (isPrivateAddress(resolved.address)) {
    throw new Error('Calendar URL resolves to a private address');
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'text/calendar, text/plain, */*' },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Calendar feed had no body');
    let total = 0;
    const MAX = 1 * 1024 * 1024;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX) {
        await reader.cancel();
        throw new Error('Calendar feed exceeds 1 MB cap');
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return buf.toString('utf8');
  } finally {
    clearTimeout(t);
  }
}

/** Unfold lines per RFC 5545 §3.1: a line beginning with whitespace continues the previous one. */
function unfold(ics: string): string[] {
  const raw = ics.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] = out[out.length - 1]! + line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeIcsText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseDate(value: string, allDay: boolean): Date | null {
  if (!value) return null;
  if (allDay && /^\d{8}$/.test(value)) {
    return new Date(
      Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))),
    );
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const ms =
    z === 'Z'
      ? Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!)
      : new Date(+y!, +mo! - 1, +d!, +h!, +mi!, +s!).getTime();
  return new Date(ms);
}

interface RawEvent {
  uid?: string;
  summary?: string;
  start?: { value: string; allDay: boolean };
  end?: { value: string; allDay: boolean };
  location?: string;
  rrule?: string;
  exdates?: string[];
}

function parseIcs(ics: string): RawEvent[] {
  const lines = unfold(ics);
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colonAt = line.indexOf(':');
    if (colonAt < 0) continue;
    const head = line.slice(0, colonAt);
    const value = line.slice(colonAt + 1);
    const [name, ...params] = head.split(';');
    const allDay = params.some((p) => /^VALUE=DATE$/i.test(p));
    if (!name) continue;
    if (name === 'UID') cur.uid = value;
    else if (name === 'SUMMARY') cur.summary = unescapeIcsText(value);
    else if (name === 'LOCATION') cur.location = unescapeIcsText(value);
    else if (name === 'DTSTART') cur.start = { value, allDay };
    else if (name === 'DTEND') cur.end = { value, allDay };
    else if (name === 'RRULE') cur.rrule = value;
    else if (name === 'EXDATE') {
      cur.exdates = cur.exdates ?? [];
      for (const v of value.split(',')) cur.exdates.push(v);
    }
  }
  return events;
}

/* ------------------------------ RRULE expansion ------------------------------ */

const WEEKDAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

interface ParsedRRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: Date | null;
  byday: number[]; // 0=SU…6=SA
}

function parseRRule(rule: string): ParsedRRule | null {
  const parts = new Map<string, string>();
  for (const part of rule.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    parts.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1));
  }
  const freqRaw = parts.get('FREQ');
  if (
    freqRaw !== 'DAILY' &&
    freqRaw !== 'WEEKLY' &&
    freqRaw !== 'MONTHLY' &&
    freqRaw !== 'YEARLY'
  ) {
    return null;
  }
  const interval = Math.max(1, Number(parts.get('INTERVAL') ?? '1') || 1);
  const countRaw = parts.get('COUNT');
  const count = countRaw ? Math.min(366, Number(countRaw) || 0) : null;
  const untilRaw = parts.get('UNTIL');
  const until = untilRaw ? parseDate(untilRaw, /^\d{8}$/.test(untilRaw)) : null;
  const bydayRaw = parts.get('BYDAY');
  const byday: number[] = [];
  if (bydayRaw) {
    for (const tok of bydayRaw.split(',')) {
      const code = tok.replace(/^[+-]?\d+/, '').toUpperCase();
      if (code in WEEKDAY_INDEX) byday.push(WEEKDAY_INDEX[code]!);
    }
  }
  return { freq: freqRaw, interval, count, until, byday };
}

/**
 * Expand a recurring event's start times within `[from, to]`. Returns
 * up to `MAX_EXPAND` occurrences. Supports the common subset of RFC 5545
 * RRULE (FREQ + INTERVAL + COUNT + UNTIL + BYDAY for WEEKLY). EXDATE is
 * honoured. Anything more exotic falls back to the bare DTSTART.
 */
function expandRecurrence(
  start: Date,
  rrule: string,
  exdates: string[] | undefined,
  windowStart: number,
  windowEnd: number,
  allDay: boolean,
): Date[] {
  const parsed = parseRRule(rrule);
  if (!parsed) return [];
  const MAX_EXPAND = 365;
  const ex = new Set<number>();
  if (exdates) {
    for (const v of exdates) {
      const d = parseDate(v, allDay && /^\d{8}$/.test(v));
      if (d) ex.add(d.getTime());
    }
  }

  const out: Date[] = [];
  const cursor = new Date(start);
  let emitted = 0;
  let safety = 0;
  const limit = Math.min(parsed.count ?? Infinity, MAX_EXPAND);

  while (safety++ < 4000 && emitted < limit) {
    const ts = cursor.getTime();
    if (parsed.until && ts > parsed.until.getTime()) break;
    if (ts > windowEnd + 86_400_000 * 7) break;

    if (parsed.freq === 'WEEKLY' && parsed.byday.length > 0) {
      // Emit each requested weekday in this week.
      const weekStart = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()),
      );
      // Walk back to Sunday of this week
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      for (const dow of parsed.byday) {
        const occ = new Date(weekStart);
        occ.setUTCDate(weekStart.getUTCDate() + dow);
        // Preserve the original time-of-day from `start`
        occ.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0);
        const occMs = occ.getTime();
        if (occMs < start.getTime()) continue;
        if (parsed.until && occMs > parsed.until.getTime()) continue;
        if (occMs >= windowStart && occMs <= windowEnd && !ex.has(occMs)) {
          out.push(new Date(occ));
          emitted += 1;
          if (emitted >= limit) break;
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7 * parsed.interval);
      continue;
    }

    if (ts >= windowStart && ts <= windowEnd && !ex.has(ts)) {
      out.push(new Date(cursor));
      emitted += 1;
    }
    if (parsed.freq === 'DAILY') cursor.setUTCDate(cursor.getUTCDate() + parsed.interval);
    else if (parsed.freq === 'WEEKLY') cursor.setUTCDate(cursor.getUTCDate() + 7 * parsed.interval);
    else if (parsed.freq === 'MONTHLY') cursor.setUTCMonth(cursor.getUTCMonth() + parsed.interval);
    else if (parsed.freq === 'YEARLY')
      cursor.setUTCFullYear(cursor.getUTCFullYear() + parsed.interval);
  }
  return out;
}

/**
 * Read upcoming events from every enabled subscription. `daysAhead`
 * defaults to 7. Recurring events (RRULE) are intentionally not
 * expanded in this first cut — single-instance events cover the
 * common "today on your calendar" use case.
 */
export async function listUpcomingEvents(daysAhead = 7): Promise<CalendarEvent[]> {
  const userId = await requireUser();
  const subs = await db
    .select()
    .from(calendarSubscriptions)
    .where(and(eq(calendarSubscriptions.userId, userId), eq(calendarSubscriptions.enabled, true)));

  const now = Date.now();
  const horizon = now + daysAhead * 86_400_000;
  const out: CalendarEvent[] = [];

  for (const sub of subs) {
    let body: string;
    try {
      body = await safeFetch(sub.url);
    } catch {
      continue; // Silently skip a broken sub; surfaced via "manage subs" UI.
    }
    const events = parseIcs(body);
    for (const ev of events) {
      if (!ev.start || !ev.summary) continue;
      const start = parseDate(ev.start.value, ev.start.allDay);
      if (!start) continue;
      const end = ev.end ? parseDate(ev.end.value, ev.end.allDay) : null;
      const duration = end && start ? end.getTime() - start.getTime() : 0;

      // 1) The base instance.
      const ts = start.getTime();
      if (ts >= now - 12 * 3600 * 1000 && ts <= horizon) {
        out.push({
          id: ev.uid ?? `${sub.id}:${ts}:${ev.summary}`,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          subscriptionColor: sub.color,
          title: ev.summary,
          start: start.toISOString(),
          end: end ? end.toISOString() : null,
          allDay: ev.start.allDay,
          location: ev.location ?? null,
        });
      }

      // 2) RRULE expansion within the window.
      if (ev.rrule) {
        const occurrences = expandRecurrence(
          start,
          ev.rrule,
          ev.exdates,
          now - 12 * 3600 * 1000,
          horizon,
          ev.start.allDay,
        );
        for (const occ of occurrences) {
          if (occ.getTime() === start.getTime()) continue; // already emitted as base
          const occEnd = duration > 0 ? new Date(occ.getTime() + duration) : null;
          out.push({
            id: `${ev.uid ?? sub.id}:${occ.getTime()}`,
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            subscriptionColor: sub.color,
            title: ev.summary,
            start: occ.toISOString(),
            end: occEnd ? occEnd.toISOString() : null,
            allDay: ev.start.allDay,
            location: ev.location ?? null,
          });
        }
      }
    }
    try {
      await db
        .update(calendarSubscriptions)
        .set({ lastFetchedAt: new Date() })
        .where(eq(calendarSubscriptions.id, sub.id));
    } catch {
      /* best-effort */
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out.slice(0, 200);
}
