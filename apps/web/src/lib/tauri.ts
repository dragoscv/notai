/**
 * Tauri runtime helpers used by web components that have desktop behaviors.
 *
 * All calls are safe in the browser — if Tauri isn't present the `invoke`
 * helper rejects with a sentinel error which call-sites can fall back from.
 */

export function isTauri(): boolean {
    return (
        typeof window !== 'undefined' &&
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    );
}

/**
 * Invoke a Tauri command. Uses the official `@tauri-apps/api/core` import
 * which handles all the IPC bookkeeping instead of us poking at internals.
 */
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauri()) throw new Error('not-in-tauri');
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
}
