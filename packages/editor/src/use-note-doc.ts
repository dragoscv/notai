'use client';
import * as React from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { createNoteDoc, type NoteDocHandle } from './provider';

// Silence the spurious hocuspocus "token required" warning. Our callers
// always pass a valid token; the warning fires because zombie websockets
// (StrictMode double-mount, Turbopack HMR, or the old window reconnecting
// after the tab regains focus) sit idle until the server closes them with
// `code=Unauthorized`, which the client misreports as "you didn't send a
// token". Scoped to this exact message string so real warnings still surface.
if (typeof window !== 'undefined' && !(window as unknown as { __notaiHpWarnPatched?: boolean }).__notaiHpWarnPatched) {
    (window as unknown as { __notaiHpWarnPatched?: boolean }).__notaiHpWarnPatched = true;
    const origWarn = console.warn;
    console.warn = function patched(...args: unknown[]) {
        const first = args[0];
        if (typeof first === 'string' && first.includes('[HocuspocusProvider]') && first.includes('authentication token is required')) {
            return;
        }
        return origWarn.apply(this, args as []);
    };
}

export interface UseNoteDocOptions {
    noteId: string;
    url: string;
    token: string;
    userName?: string;
    userColor?: string;
}

/**
 * Module-level cache with ref-counting. Dev StrictMode mounts → unmounts →
 * remounts effects synchronously; without this cache we'd tear down the
 * websocket and create another one immediately, which causes hocuspocus to
 * log spurious "token required" warnings on the close of the aborted first
 * connection. Production has StrictMode too in React 19, so this is a
 * permanent fix, not a dev workaround.
 */
interface CachedEntry {
    handle: NoteDocHandle;
    refCount: number;
    destroyTimer: ReturnType<typeof setTimeout> | null;
    listeners: {
        status: Set<(s: 'connecting' | 'connected' | 'disconnected') => void>;
        synced: Set<(s: boolean) => void>;
        lastStatus: 'connecting' | 'connected' | 'disconnected';
        lastSynced: boolean;
    };
}

const cache = new Map<string, CachedEntry>();
const DESTROY_DELAY_MS = 500;

function acquire(
    key: string,
    params: { noteId: string; url: string; token: string },
): CachedEntry {
    const existing = cache.get(key);
    if (existing) {
        if (existing.destroyTimer) {
            clearTimeout(existing.destroyTimer);
            existing.destroyTimer = null;
        }
        existing.refCount++;
        return existing;
    }
    const listeners: CachedEntry['listeners'] = {
        status: new Set(),
        synced: new Set(),
        lastStatus: 'connecting',
        lastSynced: false,
    };
    const handle = createNoteDoc({
        ...params,
        onStatus: (s) => {
            listeners.lastStatus = s;
            listeners.status.forEach((fn) => fn(s));
        },
        onSynced: (s) => {
            listeners.lastSynced = s;
            listeners.synced.forEach((fn) => fn(s));
        },
    });
    const entry: CachedEntry = { handle, refCount: 1, destroyTimer: null, listeners };
    cache.set(key, entry);
    return entry;
}

function release(key: string) {
    const entry = cache.get(key);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount > 0) return;
    // Delay actual destroy so StrictMode remount reuses the handle.
    entry.destroyTimer = setTimeout(() => {
        cache.delete(key);
        entry.handle.destroy();
    }, DESTROY_DELAY_MS);
}

export function useNoteDoc({ noteId, url, token }: UseNoteDocOptions): {
    doc: Y.Doc | null;
    provider: HocuspocusProvider | null;
    status: 'connecting' | 'connected' | 'disconnected';
    synced: boolean;
} {
    const [handle, setHandle] = React.useState<NoteDocHandle | null>(null);
    const [status, setStatus] = React.useState<'connecting' | 'connected' | 'disconnected'>(
        'connecting',
    );
    const [synced, setSynced] = React.useState(false);

    React.useEffect(() => {
        if (!token || !url || !noteId) return;
        const key = `${noteId}|${url}|${token}`;
        const entry = acquire(key, { noteId, url, token });
        setHandle(entry.handle);
        setStatus(entry.listeners.lastStatus);
        setSynced(entry.listeners.lastSynced);
        entry.listeners.status.add(setStatus);
        entry.listeners.synced.add(setSynced);
        return () => {
            entry.listeners.status.delete(setStatus);
            entry.listeners.synced.delete(setSynced);
            release(key);
        };
    }, [noteId, url, token]);

    return {
        doc: handle?.doc ?? null,
        provider: handle?.provider ?? null,
        status,
        synced,
    };
}
