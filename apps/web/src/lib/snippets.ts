'use client';

/**
 * Local snippet store.
 *
 * Snippets are short keyboard shortcuts the user types as `::name` on
 * the canvas; we replace them in-place with an expanded body. Stored in
 * `localStorage` for offline-first edits, AND mirrored to the
 * `user_snippets` table on the server so they sync across devices.
 *
 * Sync model: on first mount we fire-and-forget `listMySnippets()` and
 * merge its rows into the local cache (server wins for any name that
 * exists in both). Every `setSnippets()` writes localStorage immediately
 * and fires `saveMySnippets()` in the background.
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
let hydratedFromServer = false;
const listeners = new Set<() => void>();

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  cached = read();
  initialized = true;
  // Best-effort server hydrate on first read. Server values win for any
  // overlapping name; otherwise we keep the local copy. Fire-and-forget.
  if (!hydratedFromServer) {
    hydratedFromServer = true;
    void hydrateFromServer();
  }
}

async function hydrateFromServer() {
  try {
    const mod = await import('@/server/actions/snippets');
    const serverRows = await mod.listMySnippets();
    if (!serverRows || serverRows.length === 0) return;
    const byName = new Map<string, string>();
    for (const s of cached) byName.set(s.name, s.body);
    for (const s of serverRows) byName.set(s.name, s.body);
    const merged: Snippet[] = Array.from(byName, ([name, body]) => ({ name, body }));
    cached = merged;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* localStorage may be full or disabled */
    }
    notify();
  } catch {
    /* not signed in or offline — ignore */
  }
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
  // Fire-and-forget server sync. Errors swallowed: offline / signed-out
  // users keep working with the local copy.
  void (async () => {
    try {
      const mod = await import('@/server/actions/snippets');
      await mod.saveMySnippets({ snippets: cleaned });
    } catch {
      /* ignore */
    }
  })();
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
