'use client';

/**
 * Client-side user preferences persisted to `localStorage`.
 *
 * These are UI/ergonomic settings — not anything that needs to sync across
 * devices. If we ever want cross-device sync we can move them to a
 * `user_preferences` table without changing the call sites.
 */

import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'notai:preferences';

export interface AppPreferences {
    /** Width of the editor column. Applied globally via the `data-editor-width` attribute on `<html>`. */
    editorWidth: 'narrow' | 'comfortable' | 'wide';
    /** Whether to enable browser spellcheck in editors. Applied to `<html spellcheck>`. */
    spellcheck: boolean;
    /** Sort order for the notes list in the sidebar. */
    noteSort: 'updated' | 'created' | 'alphabetical';
}

export const DEFAULT_PREFERENCES: AppPreferences = {
    editorWidth: 'comfortable',
    spellcheck: true,
    noteSort: 'updated',
};

function readFromStorage(): AppPreferences {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_PREFERENCES;
        const parsed = JSON.parse(raw) as Partial<AppPreferences>;
        return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

let cachedSnapshot: AppPreferences = DEFAULT_PREFERENCES;
let initialized = false;

function ensureInitialized() {
    if (initialized || typeof window === 'undefined') return;
    cachedSnapshot = readFromStorage();
    initialized = true;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
            cachedSnapshot = readFromStorage();
            listeners.forEach((l) => l());
        }
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
    };
}

function getSnapshot(): AppPreferences {
    ensureInitialized();
    return cachedSnapshot;
}

function getServerSnapshot(): AppPreferences {
    return DEFAULT_PREFERENCES;
}

function write(next: AppPreferences) {
    cachedSnapshot = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* ignore quota / private-mode errors */
    }
    listeners.forEach((l) => l());
}

/**
 * Subscribe a React component to user preferences. Returns the current values
 * and an updater that merges a partial patch into storage.
 */
export function useAppPreferences() {
    const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setPreferences = useCallback((patch: Partial<AppPreferences>) => {
        write({ ...cachedSnapshot, ...patch });
    }, []);
    return [prefs, setPreferences] as const;
}
