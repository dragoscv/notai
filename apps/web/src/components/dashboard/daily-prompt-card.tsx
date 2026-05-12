'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lightbulb, Pen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  getDailyPrompt,
  createNoteFromPrompt,
  type DailyPrompt,
} from '@/server/actions/daily-prompt';
import { DailyPromptHistoryButton } from './daily-prompt-history-button';

const STORAGE_KEY = 'notai:daily-prompt';
const HISTORY_KEY = 'notai:daily-prompt-history';
const MAX_HISTORY = 30;

interface PromptHistoryEntry {
  date: string;
  prompt: string;
}

/** Persist a prompt into the rolling local history. */
function rememberPrompt(p: DailyPrompt) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const list: PromptHistoryEntry[] = raw ? JSON.parse(raw) : [];
    if (list[0]?.date === p.date && list[0]?.prompt === p.prompt) return;
    const next = [{ date: p.date, prompt: p.prompt }, ...list].slice(0, MAX_HISTORY);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readPromptHistory(): PromptHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PromptHistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * Daily writing prompt card. Generates one short, curiosity-flavoured
 * prompt per UTC day via the user's AI provider; cached in
 * localStorage so the same prompt sticks across reloads. "Write about
 * this" creates a fresh note seeded with the prompt as its title.
 */
export function DailyPromptCard() {
  const t = useTranslations('dashboard.dailyPrompt');
  const router = useRouter();
  const [data, setData] = React.useState<DailyPrompt | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async (forceRefresh = false) => {
    if (typeof window === 'undefined') return;
    if (!forceRefresh) {
      try {
        const cached = window.localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as DailyPrompt;
          const today = new Date().toISOString().slice(0, 10);
          if (parsed.date === today && parsed.prompt) {
            setData(parsed);
            rememberPrompt(parsed);
            return;
          }
        }
      } catch {
        /* localStorage unavailable */
      }
    }
    setRefreshing(true);
    try {
      const fresh = await getDailyPrompt();
      setData(fresh);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } catch {
        /* ignore */
      }
      rememberPrompt(fresh);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const writeAbout = React.useCallback(async () => {
    if (!data) return;
    setCreating(true);
    try {
      const { id } = await createNoteFromPrompt(data.prompt);
      router.push(`/app/n/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [data, router]);

  if (!data) return null;

  return (
    <div className="rounded-2xl border bg-amber-500/5 p-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <Lightbulb className="size-3.5" />
        <span>{t('label')}</span>
        <div className="ml-auto flex items-center gap-1">
          <DailyPromptHistoryButton />
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="hover:bg-muted rounded p-1 disabled:opacity-50"
            title={t('refreshTitle')}
            aria-label={t('refreshLabel')}
          >
            <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
          </button>
        </div>
      </div>
      <p className="font-serif text-base leading-snug">{data.prompt}</p>
      <div className="mt-3">
        <button
          type="button"
          onClick={writeAbout}
          disabled={creating}
          className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Pen className="size-3.5" />
          {creating ? t('creating') : t('writeAbout')}
        </button>
      </div>
    </div>
  );
}
