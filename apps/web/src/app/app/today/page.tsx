import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getOrCreateDailyNote } from '@/server/actions/daily';

export const dynamic = 'force-dynamic';

/** /app/today — opens (or creates) today's daily note. */
export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const note = await getOrCreateDailyNote();
  redirect(`/app/n/${note.id}`);
}
