'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button, Textarea } from '@notai/ui';
import { addUserReply } from '@/server/actions/support';

export function UserReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = React.useState('');
  const [pending, start] = React.useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          try {
            await addUserReply({ ticketId, body });
            setBody('');
            toast.success('Reply sent');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not send reply');
          }
        });
      }}
      className="not-prose space-y-3"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        rows={5}
        maxLength={8000}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
