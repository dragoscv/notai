/**
 * Registry of user-customizable keyboard shortcuts. Each entry has a
 * stable `id` (used as the localStorage override key) plus a default
 * combo and a human label. Settings → Shortcuts iterates this list.
 */

export interface ShortcutDefinition {
  id: string;
  label: string;
  defaultCombo: string;
  description: string;
}

export const CUSTOMIZABLE_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'command-palette',
    label: 'Command palette',
    defaultCombo: 'mod+k',
    description: 'Open the spotlight-style global search & actions.',
  },
  {
    id: 'quick-capture',
    label: 'Quick capture',
    defaultCombo: 'mod+.',
    description: 'Drop a sticky thought without leaving the page.',
  },
  {
    id: 'daily-note',
    label: 'Daily note',
    defaultCombo: 'mod+j',
    description: "Jump straight to today's daily note.",
  },
  {
    id: 'pin-toggle',
    label: 'Pin / unpin',
    defaultCombo: 'mod+shift+p',
    description: 'Toggle pin for the current note.',
  },
  {
    id: 'daily-review',
    label: 'End-of-day review',
    defaultCombo: 'mod+shift+r',
    description: 'Open the AI-powered end-of-day wrap-up.',
  },
];

const STORAGE_PREFIX = 'notai:hotkey-override:';

export function getOverride(id: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id);
  } catch {
    return null;
  }
}

export function setOverride(id: string, combo: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (combo === null || combo.trim() === '') {
      window.localStorage.removeItem(STORAGE_PREFIX + id);
    } else {
      window.localStorage.setItem(STORAGE_PREFIX + id, combo.trim());
    }
    document.dispatchEvent(new CustomEvent('notai:hotkey-override-changed', { detail: { id } }));
  } catch {
    /* ignore */
  }
}

export function effectiveCombo(def: ShortcutDefinition): string {
  return getOverride(def.id) ?? def.defaultCombo;
}
