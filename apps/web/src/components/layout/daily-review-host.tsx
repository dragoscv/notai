'use client';

import * as React from 'react';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { DailyReviewDialog } from './daily-review-dialog';

/**
 * Wires the global hotkey (Mod+Shift+R) and a custom event
 * (`notai:daily-review`) for opening the end-of-day review dialog
 * from anywhere in the app.
 */
export function DailyReviewHost() {
  const [open, setOpen] = React.useState(false);
  useHotkey('mod+shift+r', () => setOpen(true), { id: 'daily-review' });
  React.useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('notai:daily-review', handler);
    return () => document.removeEventListener('notai:daily-review', handler);
  }, []);
  return <DailyReviewDialog open={open} onOpenChange={setOpen} />;
}
