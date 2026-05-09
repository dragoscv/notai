'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button, Textarea } from '@notai/ui';
import { adminReplyTicket } from '@/server/actions/support';

export function ReplyComposer({ ticketId }: { ticketId: string }) {
  const [body, setBody] = React.useState('');
  const [internal, setInternal] = React.useState(false);
  const [pending, start] = React.useTransition();

  function send(closeAfter: boolean) {
    if (!body.trim()) return;
    start(async () => {
      try {
        await adminReplyTicket({
          ticketId,
          body,
          internal,
          newStatus: closeAfter ? 'resolved' : undefined,
        });
        setBody('');
        setInternal(false);
        toast.success(closeAfter ? 'Reply sent · marked resolved' : 'Reply sent');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      }
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={internal ? 'Internal note (not visible to user)…' : 'Reply to user…'}
        rows={6}
        maxLength={8000}
      />
      <div className="flex items-center justify-between gap-3">
        <label className="text-muted-foreground inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
          />
          Internal note (don&rsquo;t email the user)
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !body.trim() || internal}
            onClick={() => send(true)}
          >
            Send & resolve
          </Button>
          <Button size="sm" disabled={pending || !body.trim()} onClick={() => send(false)}>
            <Send className="mr-1.5 size-3.5" />
            {internal ? 'Save note' : 'Reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
