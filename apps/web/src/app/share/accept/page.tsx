import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import { acceptInvite } from '@/server/actions/sharing';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <Wrapper title="Invite link is missing a token">
        <p className="text-muted-foreground">
          Please ask the sender for the original email link.
        </p>
      </Wrapper>
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/share/accept?token=${encodeURIComponent(token)}`);
  }

  const result = await acceptInvite(token);
  if (!result) {
    return (
      <Wrapper title="This invite isn't valid anymore">
        <p className="text-muted-foreground">
          It may have expired or been revoked. Ask the owner to send a fresh invite.
        </p>
        <Button asChild>
          <Link href="/app">Go to your notes</Link>
        </Button>
      </Wrapper>
    );
  }

  redirect(`/app/n/${result.noteId}`);
}

function Wrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center px-6">
      <div className="bg-card flex max-w-md flex-col gap-3 rounded-2xl border p-8 shadow-lg">
        <h1 className="font-serif text-2xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}
