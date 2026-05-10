import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { AppShell } from '@/components/layout/app-shell';
import { AnalyticsProvider } from '@/components/layout/analytics-provider';
import { TimezoneSync } from '@/components/layout/timezone-sync';
import { VoiceCapture } from '@/components/voice/voice-capture';
import { ShortcutsCheatsheet } from '@/components/layout/shortcuts-cheatsheet';
import { QuickCapture } from '@/components/layout/quick-capture';
import { MobileCaptureFab } from '@/components/layout/mobile-capture-fab';
import { InstallPrompt } from '@/components/layout/install-prompt';
import { DailyNoteHotkey } from '@/components/layout/daily-note-hotkey';
import { OnboardingTour } from '@/components/layout/onboarding-tour';
import { PomodoroTimer } from '@/components/layout/pomodoro-timer';
import { DailyReviewHost } from '@/components/layout/daily-review-host';
import { isAdmin } from '@/server/rbac';
import { listNotes } from '@/server/actions/notes';
import { listFolders } from '@/server/actions/folders';
import { db, users, eq } from '@notai/db';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [notes, folders, admin, [me]] = await Promise.all([
    listNotes(),
    listFolders(),
    isAdmin(),
    db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
  ]);

  return (
    <Suspense>
      <AnalyticsProvider
        user={{
          id: session.user.id,
          email: session.user.email ?? null,
          name: session.user.name ?? null,
        }}
      >
        <TimezoneSync initialTimezone={me?.timezone ?? null} />
        <VoiceCapture />
        <ShortcutsCheatsheet />
        <QuickCapture />
        <MobileCaptureFab />
        <InstallPrompt />
        <DailyNoteHotkey />
        <OnboardingTour />
        <PomodoroTimer />
        <DailyReviewHost />
        <AppShell
          sidebar={<Sidebar user={session.user} notes={notes} folders={folders} isAdmin={admin} />}
          commandPalette={<CommandPalette notes={notes} />}
        >
          {children}
        </AppShell>
      </AnalyticsProvider>
    </Suspense>
  );
}
