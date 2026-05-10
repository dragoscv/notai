'use client';

/**
 * Local snippet store.
 *
 * Snippets are short keyboard shortcuts the user types as `::name` on
 * the canvas; we replace them in-place with an expanded body. Stored in
 * `localStorage` so the user can edit/import without a server round-trip.
 *
 * If we ever want sync we can mirror this into a `user_snippets` table
 * with the same shape; the public API should not need to change.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'notai:snippets-v1';

export interface Snippet {
  /** Trigger name without the `::` prefix. Lowercase, alphanumerics + dashes. */
  name: string;
  body: string;
}

export const DEFAULT_SNIPPETS: Snippet[] = [
  { name: 'today', body: '__TODAY__' },
  { name: 'now', body: '__NOW__' },
  { name: 'sig', body: '— sent from Notai' },
  { name: 'todo', body: '[ ] ' },
];

function read(): Snippet[] {
  if (typeof window === 'undefined') return DEFAULT_SNIPPETS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SNIPPETS;
    const parsed = JSON.parse(raw) as Snippet[];
    if (!Array.isArray(parsed)) return DEFAULT_SNIPPETS;
    return parsed.filter((s): s is Snippet =>
      Boolean(s && typeof s.name === 'string' && typeof s.body === 'string'),
    );
  } catch {
    return DEFAULT_SNIPPETS;
  }
}

let cached: Snippet[] = DEFAULT_SNIPPETS;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  cached = read();
  initialized = true;
}

function subscribe(cb: () => void) {
  ensureInit();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = read();
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  ensureInit();
  return cached;
}

function getServerSnapshot() {
  return DEFAULT_SNIPPETS;
}

function notify() {
  for (const l of listeners) l();
}

export function getSnippets(): Snippet[] {
  ensureInit();
  return cached;
}

export function setSnippets(next: Snippet[]) {
  if (typeof window === 'undefined') return;
  // Sanitise: trim names, strip leading "::", lowercase, dedupe.
  const seen = new Set<string>();
  const cleaned: Snippet[] = [];
  for (const s of next) {
    const name = s.name
      .trim()
      .replace(/^::/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    cleaned.push({ name, body: s.body });
  }
  cached = cleaned;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  notify();
}

export function useSnippets(): Snippet[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Expand `::name` tokens inside the given text. `__TODAY__` /
 * `__NOW__` placeholders inside snippet bodies are replaced with the
 * current date/time at expansion time.
 */
export function expandSnippets(text: string, snippets: Snippet[]): string {
  if (!text.includes('::')) return text;
  const map = new Map(snippets.map((s) => [s.name, s.body]));
  return text.replace(/::([a-z0-9-]+)/gi, (match, name: string) => {
    const body = map.get(name.toLowerCase());
    if (body == null) return match;
    return body
      .replace(/__TODAY__/g, new Date().toISOString().slice(0, 10))
      .replace(/__NOW__/g, new Date().toLocaleTimeString());
  });
}
