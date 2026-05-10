'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';

export function AcceptInviteButton({
  token,
  accept,
}: {
  token: string;
  accept: (token: string) => Promise<{ workspaceId: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="lg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await accept(token);
          toast.success('Joined workspace');
          router.push('/app/workspaces');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not accept');
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : 'Accept invite'}
    </Button>
  );
}
