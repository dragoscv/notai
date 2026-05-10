/**
 * Tiny haptics wrapper. Uses the Web Vibration API where available
 * (Android Chrome, Capacitor Android via the OS), and dispatches a
 * `notai:haptic` window event so a Capacitor plugin shim can hook in
 * later without us depending on `@capacitor/haptics` in the web bundle.
 *
 * Safe no-op on iOS Safari + desktop.
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticIntensity, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 40, 10],
  warning: [20, 40, 20],
  error: [50, 50, 50],
};

export function haptic(intensity: HapticIntensity = 'light') {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('notai:haptic', { detail: { intensity } }));
  } catch {
    /* noop */
  }
  const nav = window.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate === 'function') {
    try {
      nav.vibrate(PATTERNS[intensity]);
    } catch {
      /* noop */
    }
  }
}
