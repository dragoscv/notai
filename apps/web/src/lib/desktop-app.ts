/**
 * Constants + helpers for the desktop-app promo UI shown in the web sidebar.
 *
 * We deliberately don't try to detect OS-level installation (not reliably
 * possible from a browser). Instead, after the user successfully launches
 * the app via the `notai://` deep-link once, we remember that locally and
 * swap the primary action from "Download" to "Open".
 */

/** GitHub latest release installer URL. Override per-env via build flag. */
export const DESKTOP_DOWNLOAD_URL =
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ??
    'https://github.com/dragosdragosvlad/mynotes/releases/latest';

const LAUNCH_KEY = 'notai:desktop-launched';

export function hasLaunchedDesktop(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(LAUNCH_KEY) === '1';
    } catch {
        return false;
    }
}

export function markDesktopLaunched(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LAUNCH_KEY, '1');
    } catch {
        /* ignore */
    }
}

/**
 * Attempt to launch the desktop app via the `notai://` protocol.
 *
 * Navigates the page to `notai://open`. If the handler is registered, the
 * OS intercepts the navigation and the desktop app opens. If not, the
 * browser stays on the current page (some browsers show an error dialog).
 */
export function launchDesktop(): void {
    if (typeof window === 'undefined') return;
    markDesktopLaunched();
    // Use an iframe to avoid a visible navigation blip on unsupported browsers.
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = 'notai://open';
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 2000);
}
