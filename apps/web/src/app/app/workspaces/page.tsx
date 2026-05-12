import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { listMyWorkspaces } from '@/server/actions/workspaces';
import { WorkspaceManager } from '@/components/workspace/workspace-manager';

export const dynamic = 'force-dynamic';

export default async function WorkspacesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const [list, t] = await Promise.all([listMyWorkspaces(), getTranslations('pages.workspaces')]);
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      <div className="mt-8">
        <WorkspaceManager initial={list} />
      </div>
    </div>
  );
}
