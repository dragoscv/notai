'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';

export function AcceptInviteButton({
  token,
  accept,
}: {
  token: string;
  accept: (token: string) => Promise<{ workspaceId: string }>;
}) {
  const t = useTranslations('appFeatures.workspace');
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
          toast.success(t('joined'));
          router.push('/app/workspaces');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t('acceptFailed'));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : t('acceptInvite')}
    </Button>
  );
}
