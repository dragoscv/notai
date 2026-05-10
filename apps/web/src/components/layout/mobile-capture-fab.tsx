'use client';

import * as React from 'react';
import { Plus, Mic } from 'lucide-react';
import { haptic } from '@/lib/haptics';

/**
 * Mobile-only floating action stack. Primary (+) opens quick text
 * capture; the smaller mic opens voice capture. Both reuse global
 * events so the matching dialogs handle the rest. Hidden on `md+`
 * because desktop users have keyboard shortcuts.
 */
export function MobileCaptureFab() {
  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        type="button"
        aria-label="Voice capture"
        onClick={() => {
          haptic('light');
          document.dispatchEvent(new CustomEvent('notai:voice-capture'));
        }}
        className="bg-card text-foreground flex size-11 items-center justify-center rounded-full border shadow-md transition-transform active:scale-95"
      >
        <Mic className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Quick capture"
        onClick={() => {
          haptic('medium');
          window.dispatchEvent(new CustomEvent('notai:quick-capture-open'));
        }}
        className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}
