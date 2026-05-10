'use client';

import * as React from 'react';
import { Plus, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import {
  type WorkspaceSummary,
  type WorkspaceMemberRow,
  createWorkspace,
  deleteWorkspace,
  inviteMember,
  listWorkspaceMembers,
  removeMember,
} from '@/server/actions/workspaces';

/**
 * Minimal workspace management UI: list, create, delete, invite,
 * remove. Built on the new `workspaces` schema; folder sharing has
 * its own UI hook from the sidebar (separate change).
 */
export function WorkspaceManager({ initial }: { initial: WorkspaceSummary[] }) {
  const [list, setList] = React.useState(initial);
  const [creating, setCreating] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creating.trim()) return;
    setBusy(true);
    try {
      const { id } = await createWorkspace({ name: creating.trim() });
      setList((rows) => [...rows, { id, name: creating.trim(), role: 'owner', memberCount: 1 }]);
      setCreating('');
      toast.success('Workspace created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="flex items-center gap-2">
        <input
          value={creating}
          onChange={(e) => setCreating(e.target.value)}
          placeholder="New workspace name\u2026"
          maxLength={60}
          className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || !creating.trim()}>
          <Plus className="size-4" /> Create
        </Button>
      </form>

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No workspaces yet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {list.map((ws) => (
            <li key={ws.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {ws.role} \u00b7 {ws.memberCount} member{ws.memberCount === 1 ? '' : 's'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(openId === ws.id ? null : ws.id)}
                >
                  {openId === ws.id ? 'Hide' : 'Manage'}
                </Button>
                {ws.role === 'owner' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${ws.name}"? Members lose access immediately.`))
                        return;
                      try {
                        await deleteWorkspace(ws.id);
                        setList((rows) => rows.filter((r) => r.id !== ws.id));
                        if (openId === ws.id) setOpenId(null);
                        toast.success('Deleted');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed');
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              {openId === ws.id && <WorkspacePanel workspaceId={ws.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkspacePanel({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = React.useState<WorkspaceMemberRow[] | null>(null);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'editor' | 'viewer'>('editor');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    listWorkspaceMembers(workspaceId)
      .then((m) => alive && setMembers(m))
      .catch(() => alive && setMembers([]));
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const { url } = await inviteMember({ workspaceId, email, role });
      const fullUrl = `${window.location.origin}${url}`;
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast.success(`Invite link copied for ${email}`);
      } catch {
        toast.success(`Invite created: ${fullUrl}`);
      }
      setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not invite');
    } finally {
      setBusy(false);
    }
  };

  if (members === null) {
    return (
      <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
        <Loader2 className="size-3 animate-spin" /> Loading\u2026
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      <form onSubmit={onInvite} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="invitee@example.com"
          required
          className="bg-background flex-1 rounded-md border px-3 py-1.5 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="bg-background rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <Button type="submit" size="sm" disabled={busy || !email}>
          <UserPlus className="size-4" /> Invite
        </Button>
      </form>
      <ul className="divide-y rounded-md border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 p-2">
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-medium">{m.name ?? m.email ?? m.userId}</div>
              <div className="text-muted-foreground text-xs">{m.email}</div>
            </div>
            <span className="text-muted-foreground text-xs">{m.role}</span>
            {!m.isOwner && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm(`Remove ${m.email ?? m.userId}?`)) return;
                  try {
                    await removeMember({ workspaceId, userId: m.userId });
                    setMembers((rows) => rows!.filter((r) => r.userId !== m.userId));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed');
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
