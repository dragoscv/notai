import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { acceptInvite } from '@/server/actions/workspaces';
import { AcceptInviteButton } from '@/components/workspace/accept-invite-button';

export const dynamic = 'force-dynamic';

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/workspace/accept/${token}`)}`);
  }
  // We render a button so the user explicitly opts in (avoids
  // unintentional joins from email previews / link scanners).
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">You\u2019ve been invited</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Accept to join this workspace and start collaborating.
      </p>
      <div className="mt-8">
        <AcceptInviteButton token={token} accept={acceptInvite} />
      </div>
    </div>
  );
}
