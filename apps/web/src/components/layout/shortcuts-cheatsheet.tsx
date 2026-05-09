'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui/components/dialog';
import { Kbd } from '@notai/ui/components/kbd';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; items: Shortcut[] };

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const GROUPS: Group[] = [
  {
    title: 'Navigation',
    items: [
      { keys: [MOD, 'K'], label: 'Open command palette' },
      { keys: [MOD, 'Shift', 'K'], label: 'Ask your notes' },
      { keys: [MOD, 'N'], label: 'New note' },
      { keys: [MOD, 'J'], label: "Jump to today's daily note" },
      { keys: [MOD, ','], label: 'Open settings' },
      { keys: ['?'], label: 'Show this cheatsheet' },
    ],
  },
  {
    title: 'Capture',
    items: [{ keys: [MOD, 'Shift', 'V'], label: 'Voice capture' }],
  },
  {
    title: 'Editor',
    items: [
      { keys: ['/'], label: 'Slash command menu' },
      { keys: [MOD, 'B'], label: 'Bold' },
      { keys: [MOD, 'I'], label: 'Italic' },
      { keys: [MOD, 'Shift', 'X'], label: 'Strikethrough' },
      { keys: [MOD, 'E'], label: 'Inline code' },
      { keys: [MOD, 'Z'], label: 'Undo' },
      { keys: [MOD, 'Shift', 'Z'], label: 'Redo' },
    ],
  },
];

export function ShortcutsCheatsheet() {
  const [open, setOpen] = React.useState(false);

  useHotkey('shift+/', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.isContentEditable) return;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    setOpen((v) => !v);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span>{item.label}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-muted-foreground text-[10px]">+</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px]">
          Press <Kbd>?</Kbd> anywhere to open this list. Press <Kbd>Esc</Kbd> to close.
        </p>
      </DialogContent>
    </Dialog>
  );
}
