'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button, Textarea } from '@notai/ui';
import { addUserReply } from '@/server/actions/support';

interface ReplyLabels {
  placeholder: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
}

export function UserReplyForm({ ticketId, labels }: { ticketId: string; labels: ReplyLabels }) {
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
            toast.success(labels.success);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : labels.error);
          }
        });
      }}
      className="not-prose space-y-3"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={labels.placeholder}
        rows={5}
        maxLength={8000}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}
