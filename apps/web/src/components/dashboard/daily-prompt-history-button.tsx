'use client';

import * as React from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import { readPromptHistory } from './daily-prompt-card';
import { createNoteFromPrompt } from '@/server/actions/daily-prompt';
import { useRouter } from 'next/navigation';

/**
 * Lightweight popover listing the last ~30 daily journal prompts the
 * user has seen, sourced from `localStorage`. Clicking one reuses it
 * to seed a new note via `createNoteFromPrompt`.
 */
export function DailyPromptHistoryButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [history, setHistory] = React.useState<Array<{ date: string; prompt: string }>>([]);

  React.useEffect(() => {
    if (!open) return;
    setHistory(readPromptHistory());
  }, [open]);

  const reuse = async (prompt: string) => {
    try {
      const { id } = await createNoteFromPrompt(prompt);
      router.push(`/app/n/${id}`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start a note');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]"
          aria-label="Recent journal prompts"
        >
          <History className="size-3.5" /> History
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        {history.length === 0 ? (
          <p className="text-muted-foreground p-2 text-center text-xs">
            No past prompts yet \u2014 they\u2019ll appear here as you keep showing up.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {history.map((h, i) => (
              <li key={`${h.date}-${i}`}>
                <button
                  type="button"
                  onClick={() => void reuse(h.prompt)}
                  className="hover:bg-accent block w-full rounded-md px-2 py-1.5 text-left text-xs"
                >
                  <div className="text-muted-foreground text-[10px]">{h.date}</div>
                  <div className="font-serif">{h.prompt}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
