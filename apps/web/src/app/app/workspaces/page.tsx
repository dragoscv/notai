import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMyWorkspaces } from '@/server/actions/workspaces';
import { WorkspaceManager } from '@/components/workspace/workspace-manager';

export const dynamic = 'force-dynamic';

export default async function WorkspacesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const list = await listMyWorkspaces();
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Create a team space, invite collaborators, and share folders.
      </p>
      <div className="mt-8">
        <WorkspaceManager initial={list} />
      </div>
    </div>
  );
}
