'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  CUSTOMIZABLE_SHORTCUTS,
  effectiveCombo,
  setOverride,
  type ShortcutDefinition,
} from '@/lib/shortcuts';
import { Input } from '@notai/ui/components/input';
import { Button } from '@notai/ui/components/button';

/**
 * Settings → Shortcuts editor. Each row shows the default combo and
 * lets the user type a custom one. Edits persist to `localStorage`
 * via `setOverride`, which fires a custom event so live `useHotkey`
 * callers re-bind without a page reload.
 */
export function ShortcutsEditor() {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Override any shortcut below. Use <code>mod</code> for Cmd/Ctrl, e.g.{' '}
        <code>mod+shift+k</code>. Leave blank to reset.
      </p>
      <div className="space-y-2">
        {CUSTOMIZABLE_SHORTCUTS.map((def) => (
          <ShortcutRow key={def.id} def={def} />
        ))}
      </div>
    </div>
  );
}

function ShortcutRow({ def }: { def: ShortcutDefinition }) {
  const [value, setValue] = React.useState(() => effectiveCombo(def));
  const isDefault = value === def.defaultCombo;

  React.useEffect(() => {
    setValue(effectiveCombo(def));
  }, [def]);

  const commit = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === def.defaultCombo) {
      setOverride(def.id, null);
      setValue(def.defaultCombo);
    } else {
      setOverride(def.id, trimmed);
      setValue(trimmed);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{def.label}</div>
        <div className="text-muted-foreground truncate text-xs">{def.description}</div>
      </div>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-7 w-36 font-mono text-xs"
        aria-label={`${def.label} shortcut`}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isDefault}
        onClick={() => commit('')}
        title="Reset to default"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}
