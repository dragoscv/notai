'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Megaphone } from 'lucide-react';
import { Button, Input, Textarea, Label, Badge } from '@notai/ui';
import { createBroadcast, deleteBroadcast } from '@/server/actions/admin';

interface Broadcast {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduledFor: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export function BroadcastsClient({ broadcasts: initial }: { broadcasts: Broadcast[] }) {
  const [list, setList] = React.useState(initial);
  const [composing, setComposing] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [schedule, setSchedule] = React.useState('');
  const [pending, start] = React.useTransition();

  return (
    <div>
      <div className="flex items-center justify-between border-b p-4">
        <span className="text-muted-foreground text-xs">{list.length} broadcast(s)</span>
        <Button size="sm" variant="outline" onClick={() => setComposing((v) => !v)}>
          <Plus className="mr-1.5 size-3.5" />
          Compose
        </Button>
      </div>

      <AnimatePresence>
        {composing ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b"
          >
            <div className="space-y-3 p-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Body (markdown)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Schedule for (optional, ISO date)</Label>
                <Input
                  type="datetime-local"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || !title.trim() || !body.trim()}
                  onClick={() =>
                    start(async () => {
                      try {
                        await createBroadcast({
                          title: title.trim(),
                          body: body.trim(),
                          scheduledFor: schedule ? new Date(schedule) : null,
                        });
                        toast.success('Broadcast saved');
                        setTitle('');
                        setBody('');
                        setSchedule('');
                        setComposing(false);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed');
                      }
                    })
                  }
                >
                  {schedule ? 'Schedule' : 'Save draft'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="divide-y">
        {list.length === 0 && !composing ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-12 text-center text-sm">
            <Megaphone className="size-8 opacity-30" />
            No broadcasts yet.
          </div>
        ) : (
          list.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{b.title}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {b.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{b.body}</p>
                <div className="text-muted-foreground/70 mt-1.5 text-[10px]">
                  Created {b.createdAt.toLocaleDateString()}
                  {b.scheduledFor ? ` · scheduled ${b.scheduledFor.toLocaleString()}` : ''}
                  {b.sentAt ? ` · sent ${b.sentAt.toLocaleString()}` : ''}
                </div>
              </div>
              <button
                className="text-muted-foreground transition hover:text-rose-500"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!confirm(`Delete "${b.title}"?`)) return;
                    try {
                      await deleteBroadcast(b.id);
                      setList((prev) => prev.filter((x) => x.id !== b.id));
                      toast.success('Deleted');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    }
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
