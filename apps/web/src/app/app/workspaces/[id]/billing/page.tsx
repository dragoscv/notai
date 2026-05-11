import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getWorkspaceBilling } from '@/server/actions/workspace-billing';
import { WorkspaceBillingPanel } from '@/components/workspace/workspace-billing-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workspace billing · notai' };

export default async function WorkspaceBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const { id } = await params;
  const data = await getWorkspaceBilling(id);
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace billing</h1>
        <p className="text-muted-foreground text-sm">
          Per-seat subscription for this workspace. Charged per active member.
        </p>
      </header>
      <WorkspaceBillingPanel workspaceId={id} initial={data} />
    </div>
  );
}
