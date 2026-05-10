'use client';
import { useRouter } from 'next/navigation';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';

/**
 * \u2318/Ctrl+J jumps to (or creates) today's daily note. Mirrors the
 * cheatsheet entry that already advertises this shortcut. The route
 * itself does the get-or-create on the server, so this component is
 * a one-liner.
 */
export function DailyNoteHotkey() {
  const router = useRouter();
  useHotkey(
    'mod+j',
    () => {
      router.push('/app/today');
    },
    { id: 'daily-note' },
  );
  return null;
}
