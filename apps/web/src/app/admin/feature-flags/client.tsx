'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Switch, Label } from '@notai/ui';
import { upsertFeatureFlag, deleteFeatureFlag } from '@/server/actions/admin';

interface Flag {
  key: string;
  description: string | null;
  defaultEnabled: boolean;
  rolloutPercent: number | null;
}

export function FlagsClient({ flags: initial }: { flags: Flag[] }) {
  const [flags, setFlags] = React.useState(initial);
  const [creating, setCreating] = React.useState(false);
  const [newKey, setNewKey] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [pending, start] = React.useTransition();

  return (
    <div>
      <div className="flex items-center justify-between border-b p-4">
        <span className="text-muted-foreground text-xs">{flags.length} flag(s)</span>
        <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1.5 size-3.5" />
          New flag
        </Button>
      </div>

      <AnimatePresence>
        {creating ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b"
          >
            <div className="space-y-3 p-4">
              <div>
                <Label>Key</Label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. ai_assistant_v2"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || !newKey.trim()}
                  onClick={() =>
                    start(async () => {
                      try {
                        await upsertFeatureFlag({
                          key: newKey.trim(),
                          description: newDesc.trim() || undefined,
                          defaultEnabled: false,
                        });
                        setFlags((prev) => [
                          ...prev,
                          {
                            key: newKey.trim(),
                            description: newDesc.trim() || null,
                            defaultEnabled: false,
                            rolloutPercent: null,
                          },
                        ]);
                        setNewKey('');
                        setNewDesc('');
                        setCreating(false);
                        toast.success('Flag created');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed');
                      }
                    })
                  }
                >
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="divide-y">
        {flags.length === 0 && !creating ? (
          <div className="text-muted-foreground p-10 text-center text-sm">
            No flags yet. Create your first one.
          </div>
        ) : (
          flags.map((flag) => (
            <div key={flag.key} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <code className="font-mono text-sm font-semibold">{flag.key}</code>
                {flag.description ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">{flag.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {flag.defaultEnabled ? 'on' : 'off'}
                  </span>
                  <Switch
                    checked={flag.defaultEnabled}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      start(async () => {
                        try {
                          await upsertFeatureFlag({
                            key: flag.key,
                            description: flag.description ?? undefined,
                            defaultEnabled: checked,
                          });
                          setFlags((prev) =>
                            prev.map((f) =>
                              f.key === flag.key ? { ...f, defaultEnabled: checked } : f,
                            ),
                          );
                          toast.success(`${flag.key}: ${checked ? 'enabled' : 'disabled'}`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed');
                        }
                      })
                    }
                  />
                </div>
                <button
                  className="text-muted-foreground transition hover:text-rose-500"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      if (!confirm(`Delete flag "${flag.key}"?`)) return;
                      try {
                        await deleteFeatureFlag(flag.key);
                        setFlags((prev) => prev.filter((f) => f.key !== flag.key));
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
