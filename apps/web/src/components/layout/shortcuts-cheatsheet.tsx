'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui/components/dialog';
import { Kbd } from '@notai/ui/components/kbd';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';

type Shortcut = { keys: string[]; labelKey: string };
type Group = { titleKey: string; items: Shortcut[] };

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const GROUPS: Group[] = [
  {
    titleKey: 'navigation',
    items: [
      { keys: [MOD, 'K'], labelKey: 'openCommandPalette' },
      { keys: [MOD, 'Shift', 'K'], labelKey: 'askNotes' },
      { keys: [MOD, 'N'], labelKey: 'newNote' },
      { keys: [MOD, 'J'], labelKey: 'jumpToday' },
      { keys: [MOD, '\\'], labelKey: 'toggleSidebar' },
      { keys: [MOD, ','], labelKey: 'openSettings' },
      { keys: ['?'], labelKey: 'showCheatsheet' },
    ],
  },
  {
    titleKey: 'capture',
    items: [
      { keys: [MOD, '.'], labelKey: 'quickCapture' },
      { keys: [MOD, 'Shift', 'V'], labelKey: 'voiceCapture' },
    ],
  },
  {
    titleKey: 'editor',
    items: [
      { keys: ['/'], labelKey: 'slashMenu' },
      { keys: [MOD, 'B'], labelKey: 'bold' },
      { keys: [MOD, 'I'], labelKey: 'italic' },
      { keys: [MOD, 'Shift', 'X'], labelKey: 'strikethrough' },
      { keys: [MOD, 'E'], labelKey: 'inlineCode' },
      { keys: [MOD, 'Z'], labelKey: 'undo' },
      { keys: [MOD, 'Shift', 'Z'], labelKey: 'redo' },
    ],
  },
  {
    titleKey: 'canvas',
    items: [
      { keys: ['F'], labelKey: 'focusToggle' },
      { keys: ['Esc'], labelKey: 'focusExit' },
      { keys: [MOD, 'Shift', '↑'], labelKey: 'moveLineUp' },
      { keys: [MOD, 'Shift', '↓'], labelKey: 'moveLineDown' },
      { keys: ['Hold', '🎙'], labelKey: 'holdMic' },
    ],
  },
  {
    titleKey: 'sidebar',
    items: [
      { keys: [MOD, 'Click'], labelKey: 'selectStart' },
      { keys: ['Shift', 'Click'], labelKey: 'selectRange' },
      { keys: ['Esc'], labelKey: 'selectClear' },
    ],
  },
];

export function ShortcutsCheatsheet() {
  const t = useTranslations('commandPalette.cheatsheet');
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
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.titleKey}>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                {t(`groups.${group.titleKey}`)}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item.labelKey}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{t(`items.${item.labelKey}`)}</span>
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
          {t.rich('footnote', {
            kbd: (chunks) => <Kbd>{chunks}</Kbd>,
          })}
        </p>
      </DialogContent>
    </Dialog>
  );
}
