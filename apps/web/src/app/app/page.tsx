import { Pin, PenLine, Plus, Sparkles, StickyNote } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '../../../i18n';
import { listNotes, createNote } from '@/server/actions/notes';
import { listFolders } from '@/server/actions/folders';
import { listTags } from '@/server/actions/tags';
import { listDashboardViews } from '@/server/actions/views';
import { Button } from '@notai/ui/components/button';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { MorningBriefCard } from '@/components/dashboard/morning-brief-card';
import { ThrowbackCard } from '@/components/dashboard/throwback-card';
import { StaleTodosCard } from '@/components/dashboard/stale-todos-card';
import { StreakBadge } from '@/components/dashboard/streak-badge';
import { TimeOfDayChip } from '@/components/dashboard/time-of-day-chip';
import { WeeklyReviewCard } from '@/components/dashboard/weekly-review-card';
import { InboxZeroNudge } from '@/components/dashboard/inbox-zero-nudge';
import { ContinueCard } from '@/components/dashboard/continue-card';
import { DailyPromptCard } from '@/components/dashboard/daily-prompt-card';
import { DailyRecapCard } from '@/components/dashboard/daily-recap-card';
import { SentimentHeatmap } from '@/components/dashboard/sentiment-heatmap';
import { OpenLoopsCard } from '@/components/dashboard/open-loops-card';
import { AutoArchiveNudge } from '@/components/dashboard/auto-archive-nudge';
import { TrashPurgeNudge } from '@/components/dashboard/trash-purge-nudge';
import { TodayTasksCard } from '@/components/dashboard/today-tasks-card';
import { CalendarTodayCard } from '@/components/dashboard/calendar-today-card';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Home' };

export default async function AppHome() {
  const [notes, views, folders, tags, locale, t] = await Promise.all([
    listNotes({ archived: false }),
    listDashboardViews(),
    listFolders(),
    listTags(),
    resolveLocale(),
    getTranslations('appShell.home'),
  ]);
  const isEmpty = notes.length === 0;

  async function createAndOpen(formData: FormData) {
    'use server';
    const kind = (formData.get('kind') as 'note' | 'sticky') ?? 'note';
    const note = await createNote({ kind });
    if (note) redirect(`/app/n/${note.id}`);
  }

  const today = new Date();
  const intlLocale = locale === 'ro' ? 'ro-RO' : 'en-US';
  const weekday = today.toLocaleDateString(intlLocale, { weekday: 'long' });
  const dateLabel = today.toLocaleDateString(intlLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background/70 flex items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarToggle />
          <span
            aria-hidden
            className="from-primary to-primary/70 text-primary-foreground shadow-primary/20 grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-sm"
          >
            <PenLine className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl font-semibold tracking-tight md:text-2xl">
              {weekday}
            </h1>
            <p className="text-muted-foreground truncate text-xs md:text-sm">
              {dateLabel} ·{' '}
              {notes.length === 1
                ? t('notesCountOne', { count: notes.length })
                : t('notesCountOther', { count: notes.length })}
            </p>
          </div>
        </div>
        <form action={createAndOpen} className="flex shrink-0 gap-2">
          <Button
            type="submit"
            name="kind"
            value="sticky"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Sparkles /> {t('newSticky')}
          </Button>
          <Button
            type="submit"
            name="kind"
            value="sticky"
            variant="outline"
            size="icon-sm"
            className="sm:hidden"
            aria-label={t('newStickyAria')}
          >
            <Sparkles />
          </Button>
          <Button
            type="submit"
            name="kind"
            value="note"
            size="sm"
            className="shadow-primary/20 hidden shadow-sm sm:inline-flex"
          >
            <Plus /> {t('newNote')}
          </Button>
          <Button
            type="submit"
            name="kind"
            value="note"
            size="icon-sm"
            className="shadow-primary/20 shadow-sm sm:hidden"
            aria-label={t('newNoteAria')}
          >
            <Plus />
          </Button>
        </form>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="p-6">
            <EmptyState
              eyebrow={t('emptyEyebrow')}
              headline={t('emptyHeadline')}
              hintPrefix={t('emptyHintPrefix')}
              hintSuffix={t('emptyHintSuffix')}
              createFirstNote={t('createFirstNote')}
              addSticky={t('addSticky')}
            />
          </div>
        ) : (
          <div className="flex flex-col pb-6">
            <div className="px-4 pt-4 md:px-6">
              <div className="mb-2 flex items-center justify-end gap-2">
                <TimeOfDayChip />
                <StreakBadge />
              </div>
              <MorningBriefCard />
            </div>
            <div className="px-4 md:px-6">
              <TodayTasksCard />
            </div>
            <div className="px-4 md:px-6">
              <CalendarTodayCard />
            </div>
            <div className="px-4 md:px-6">
              <DailyPromptCard />
            </div>
            <div className="px-4 md:px-6">
              <DailyRecapCard />
            </div>
            <div className="px-4 md:px-6">
              <SentimentHeatmap />
            </div>
            <div className="px-4 md:px-6">
              <OpenLoopsCard />
            </div>
            <div className="px-4 md:px-6">
              <AutoArchiveNudge />
            </div>
            <div className="px-4 md:px-6">
              <TrashPurgeNudge />
            </div>
            <div className="px-4 md:px-6">
              <ThrowbackCard />
            </div>
            <div className="px-4 md:px-6">
              <InboxZeroNudge />
            </div>
            <div className="px-4 md:px-6">
              <ContinueCard />
            </div>
            <div className="px-4 md:px-6">
              <WeeklyReviewCard />
            </div>
            <div className="px-4 md:px-6">
              <StaleTodosCard />
            </div>
            <div>
              <DashboardView views={views} notes={notes} folders={folders} tags={tags} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  eyebrow,
  headline,
  hintPrefix,
  hintSuffix,
  createFirstNote,
  addSticky,
}: {
  eyebrow: string;
  headline: string;
  hintPrefix: string;
  hintSuffix: string;
  createFirstNote: string;
  addSticky: string;
}) {
  return (
    <div className="bg-card/60 relative mx-auto max-w-2xl overflow-hidden rounded-2xl border p-10 text-center backdrop-blur">
      {/* subtle warm wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(600px 300px at 50% -10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%)',
        }}
      />

      {/* sticky note collage */}
      <div className="relative mx-auto mb-8 h-40 w-72">
        <div className="bg-sticky-yellow text-foreground/80 shadow-foreground/10 absolute -left-2 top-2 w-44 rotate-[-7deg] rounded-md p-3 text-left text-[12px] leading-snug shadow-lg">
          <div className="text-foreground/50 mb-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide">
            <Pin className="size-2.5" /> idea
          </div>
          What should I write first?
        </div>
        <div className="bg-sticky-pink text-foreground/80 shadow-foreground/10 absolute right-0 top-1 w-40 rotate-[6deg] rounded-md p-3 text-left text-[12px] leading-snug shadow-lg">
          <div className="text-foreground/50 mb-1 text-[9px] font-medium uppercase tracking-wide">
            Today
          </div>
          Morning coffee · Plan the week ☕
        </div>
        <div className="bg-sticky-blue text-foreground/80 shadow-foreground/10 absolute -bottom-1 left-12 w-44 rotate-[-3deg] rounded-md p-3 text-left text-[12px] leading-snug shadow-lg">
          <div className="text-foreground/50 mb-1 text-[9px] font-medium uppercase tracking-wide">
            Sketch
          </div>
          Doodle something just for fun ✏️
        </div>
      </div>

      <div className="relative">
        <p className="text-primary text-xs font-medium uppercase tracking-wider">{eyebrow}</p>
        <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{headline}</h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          {hintPrefix}
          <kbd className="bg-muted rounded border px-1.5 py-0.5 text-xs">N</kbd>
          {hintSuffix}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <NewNoteAction kind="note" label={createFirstNote} icon={<PenLine />} />
          <NewNoteAction kind="sticky" label={addSticky} icon={<StickyNote />} variant="outline" />
        </div>
      </div>
    </div>
  );
}

function NewNoteAction({
  kind,
  label,
  icon,
  variant = 'default',
}: {
  kind: 'note' | 'sticky';
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'outline';
}) {
  async function action() {
    'use server';
    const note = await createNote({ kind });
    if (note) redirect(`/app/n/${note.id}`);
  }
  return (
    <form action={action}>
      <Button
        type="submit"
        size="lg"
        variant={variant}
        className={variant === 'default' ? 'shadow-primary/20 shadow-lg' : ''}
      >
        {icon} {label}
      </Button>
    </form>
  );
}
