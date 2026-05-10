'use client';
import * as React from 'react';

/**
 * Resolve the effective combo for a registered hotkey id, allowing
 * users to override defaults via Settings → Shortcuts. Reads from
 * `localStorage` under `notai:hotkey-override:{id}`.
 */
function resolveCombo(combo: string, id?: string): string {
  if (!id || typeof window === 'undefined') return combo;
  try {
    const override = window.localStorage.getItem(`notai:hotkey-override:${id}`);
    if (override && override.trim()) return override.trim();
  } catch {
    /* ignore */
  }
  return combo;
}

/**
 * Register a global keyboard shortcut. Supports "mod+k", "shift+/", etc.
 * "mod" = Cmd on macOS, Ctrl elsewhere. Pass `options.id` to make the
 * shortcut user-customizable from Settings → Shortcuts.
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: { enabled?: boolean; preventDefault?: boolean; id?: string } = {},
) {
  const { enabled = true, preventDefault = true, id } = options;
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  // Re-resolve when an override changes elsewhere in the same tab.
  const [overrideTick, setOverrideTick] = React.useState(0);
  React.useEffect(() => {
    if (!id) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === `notai:hotkey-override:${id}`) setOverrideTick((t) => t + 1);
    };
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail || detail.id === id) setOverrideTick((t) => t + 1);
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('notai:hotkey-override-changed', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('notai:hotkey-override-changed', onLocal);
    };
  }, [id]);

  React.useEffect(() => {
    if (!enabled) return;
    const effective = resolveCombo(combo, id);
    const parts = effective
      .toLowerCase()
      .split('+')
      .map((p) => p.trim());
    const needsMod = parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd');
    const needsShift = parts.includes('shift');
    const needsAlt = parts.includes('alt');
    const key = parts.find((p) => !['mod', 'ctrl', 'cmd', 'shift', 'alt'].includes(p));
    if (!key) return;

    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

    function onKeyDown(e: KeyboardEvent) {
      const modPressed = isMac ? e.metaKey : e.ctrlKey;
      if (needsMod && !modPressed) return;
      if (!needsMod && modPressed) return;
      if (needsShift !== e.shiftKey) return;
      if (needsAlt !== e.altKey) return;
      if (e.key.toLowerCase() !== key) return;
      if (preventDefault) e.preventDefault();
      handlerRef.current(e);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled, preventDefault, id, overrideTick]);
}
