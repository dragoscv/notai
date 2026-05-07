'use client';
import { useEffect, useState, useCallback } from 'react';

/**
 * Shared registry of currently-open sticky windows.
 *
 * Works across:
 *   - Browser popup windows (same origin → shared localStorage + BroadcastChannel).
 *   - Tauri webview windows (same origin → same).
 *
 * Each sticky window calls `useRegisterOpenSticky(id, title)` which writes
 * its own entry and heartbeats every 3s. Listeners (main window, sidebar)
 * call `useOpenStickies()` to get the live list, which filters out stale
 * entries (>8s without a heartbeat = assumed closed).
 */
export interface OpenSticky {
    id: string;
    title: string;
    updatedAt: number;
}

const LS_KEY = 'notai:open-stickies';
const CHANNEL = 'notai:open-stickies';
const HEARTBEAT_MS = 3000;
const STALE_MS = 8000;

type Registry = Record<string, OpenSticky>;

function readRegistry(): Registry {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Registry;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

function writeRegistry(reg: Registry) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(reg));
    } catch {
        /* quota — ignore */
    }
}

function pruneStale(reg: Registry): Registry {
    const now = Date.now();
    const out: Registry = {};
    for (const [id, entry] of Object.entries(reg)) {
        if (now - entry.updatedAt < STALE_MS) out[id] = entry;
    }
    return out;
}

function broadcast() {
    try {
        const ch = new BroadcastChannel(CHANNEL);
        ch.postMessage({ t: Date.now() });
        ch.close();
    } catch {
        /* BroadcastChannel unsupported — storage event will cover it */
    }
}

/**
 * Register this browsing context as an open sticky window for `noteId`.
 * Automatically heartbeats and cleans up on unload.
 */
export function useRegisterOpenSticky(noteId: string, title: string) {
    useEffect(() => {
        if (!noteId) return;
        const tick = () => {
            const reg = pruneStale(readRegistry());
            reg[noteId] = { id: noteId, title: title || 'Untitled', updatedAt: Date.now() };
            writeRegistry(reg);
            broadcast();
        };
        tick();
        const handle = window.setInterval(tick, HEARTBEAT_MS);

        const cleanup = () => {
            const reg = readRegistry();
            delete reg[noteId];
            writeRegistry(reg);
            broadcast();
        };
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('pagehide', cleanup);

        return () => {
            window.clearInterval(handle);
            cleanup();
            window.removeEventListener('beforeunload', cleanup);
            window.removeEventListener('pagehide', cleanup);
        };
    }, [noteId, title]);
}

/**
 * Subscribe to the live list of open stickies.
 * Returns sorted-by-title list of non-stale entries.
 */
export function useOpenStickies(): OpenSticky[] {
    const [list, setList] = useState<OpenSticky[]>(() =>
        Object.values(pruneStale(readRegistry())).sort((a, b) => a.title.localeCompare(b.title)),
    );

    const refresh = useCallback(() => {
        const reg = pruneStale(readRegistry());
        setList(Object.values(reg).sort((a, b) => a.title.localeCompare(b.title)));
    }, []);

    useEffect(() => {
        refresh();
        const onStorage = (e: StorageEvent) => {
            if (e.key === LS_KEY || e.key === null) refresh();
        };
        window.addEventListener('storage', onStorage);

        let ch: BroadcastChannel | null = null;
        try {
            ch = new BroadcastChannel(CHANNEL);
            ch.onmessage = refresh;
        } catch {
            /* ignore */
        }

        // Poll to expire stale entries even if nothing broadcasts.
        const handle = window.setInterval(refresh, HEARTBEAT_MS);

        return () => {
            window.removeEventListener('storage', onStorage);
            ch?.close();
            window.clearInterval(handle);
        };
    }, [refresh]);

    return list;
}

/**
 * Remove an entry (used when closing a sticky from outside — we can't close
 * another window's `window` object in the browser, but we can drop its entry
 * so it disappears from the list until it heartbeats again).
 */
export function forgetOpenSticky(noteId: string) {
    const reg = readRegistry();
    delete reg[noteId];
    writeRegistry(reg);
    broadcast();
}
