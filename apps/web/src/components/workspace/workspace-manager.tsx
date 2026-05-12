'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, UserPlus, Trash2, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('appFeatures.workspace');
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
      toast.success(t('created'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('createFailed'));
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
          placeholder={t('newPlaceholder')}
          maxLength={60}
          className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || !creating.trim()}>
          <Plus className="size-4" /> {t('create')}
        </Button>
      </form>

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('none')}</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {list.map((ws) => (
            <li key={ws.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {t('summary', {
                      role: t(
                        ws.role === 'owner'
                          ? 'roleOwner'
                          : ws.role === 'admin'
                            ? 'roleAdmin'
                            : ws.role === 'editor'
                              ? 'roleEditor'
                              : 'roleViewer',
                      ),
                      members:
                        ws.memberCount === 1
                          ? t('memberCountOne', { count: ws.memberCount })
                          : t('memberCountOther', { count: ws.memberCount }),
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(openId === ws.id ? null : ws.id)}
                >
                  {openId === ws.id ? t('hide') : t('manage')}
                </Button>
                {(ws.role === 'owner' || ws.role === 'admin') && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/app/workspaces/${ws.id}/billing`} title={t('billingTitle')}>
                      <CreditCard className="size-4" />
                    </Link>
                  </Button>
                )}
                {ws.role === 'owner' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm(t('deleteConfirm', { name: ws.name }))) return;
                      try {
                        await deleteWorkspace(ws.id);
                        setList((rows) => rows.filter((r) => r.id !== ws.id));
                        if (openId === ws.id) setOpenId(null);
                        toast.success(t('deleted'));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : t('failed'));
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
  const t = useTranslations('appFeatures.workspace');
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
        toast.success(t('inviteCopied', { email }));
      } catch {
        toast.success(t('inviteCreated', { url: fullUrl }));
      }
      setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('inviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (members === null) {
    return (
      <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
        <Loader2 className="size-3 animate-spin" /> {t('loading')}
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
          placeholder={t('inviteEmailPlaceholder')}
          required
          className="bg-background flex-1 rounded-md border px-3 py-1.5 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="bg-background rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="admin">{t('roleAdminOption')}</option>
          <option value="editor">{t('roleEditorOption')}</option>
          <option value="viewer">{t('roleViewerOption')}</option>
        </select>
        <Button type="submit" size="sm" disabled={busy || !email}>
          <UserPlus className="size-4" /> {t('invite')}
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
                  if (!window.confirm(t('removeConfirm', { who: m.email ?? m.userId }))) return;
                  try {
                    await removeMember({ workspaceId, userId: m.userId });
                    setMembers((rows) => rows!.filter((r) => r.userId !== m.userId));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t('failed'));
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
