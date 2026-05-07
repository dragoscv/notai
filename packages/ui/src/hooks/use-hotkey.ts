'use client';
import * as React from 'react';

/**
 * Register a global keyboard shortcut. Supports "mod+k", "shift+/", etc.
 * "mod" = Cmd on macOS, Ctrl elsewhere.
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {},
) {
  const { enabled = true, preventDefault = true } = options;
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    if (!enabled) return;
    const parts = combo
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
  }, [combo, enabled, preventDefault]);
}
