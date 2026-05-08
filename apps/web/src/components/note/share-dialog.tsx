'use client';
import * as React from 'react';
import { Loader2, Mail, Trash2, UserRound, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@notai/ui/components/avatar';
import { Button } from '@notai/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@notai/ui/components/dialog';
import { Input } from '@notai/ui/components/input';
import { Label } from '@notai/ui/components/label';
import { getInitials } from '@notai/lib/utils';
import { toast } from 'sonner';
import {
  inviteToNote,
  listShare,
  removeCollaborator,
  revokeInvite,
  updateCollaboratorRole,
  type ShareRow,
} from '@/server/actions/sharing';

export function ShareDialog({
  noteId,
  ownerId,
  currentUserId,
}: {
  noteId: string;
  ownerId: string;
  currentUserId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ShareRow[]>([]);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const isOwner = ownerId === currentUserId;

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    listShare(noteId)
      .then(setRows)
      .catch(() => toast.error("Couldn't load share details"))
      .finally(() => setLoading(false));
  }, [open, noteId]);

  function refresh() {
    listShare(noteId)
      .then(setRows)
      .catch(() => undefined);
  }

  const onInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      try {
        const res = await inviteToNote({ noteId, email: email.trim(), role });
        if (res.status === 'added') toast.success('Added to the note');
        else if (res.status === 'invited') toast.success(`Invite sent to ${email}`);
        else if (res.status === 'already_owner') toast.info("That's you 🙂");
        setEmail('');
        refresh();
      } catch (err) {
        toast.error((err as Error).message ?? 'Invite failed');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs">
          <Users className="size-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this note</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'Invite anyone by email. They get a link to open the note in real time.'
              : 'You have access to this note. Only the owner can invite others.'}
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={onInvite} className="flex flex-col gap-2">
            <Label htmlFor="invite-email" className="text-xs font-medium">
              Email
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="bg-background h-9 rounded-md border px-2 text-sm"
                aria-label="Role"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <Button type="submit" disabled={pending || !email.trim()}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : 'Invite'}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-2">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
            People with access
          </p>
          {loading ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              <Loader2 className="mr-2 inline size-4 animate-spin" /> Loading…
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2">
                  {r.kind === 'collaborator' ? (
                    <>
                      <Avatar className="size-7">
                        {r.image && <AvatarImage src={r.image} />}
                        <AvatarFallback className="from-primary/30 to-primary/10 bg-gradient-to-br text-[10px]">
                          {getInitials(r.name, r.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.name || r.email || 'User'}</p>
                        {r.email && (
                          <p className="text-muted-foreground truncate text-xs">{r.email}</p>
                        )}
                      </div>
                      {r.role === 'owner' ? (
                        <span className="text-muted-foreground text-xs">Owner</span>
                      ) : isOwner ? (
                        <>
                          <select
                            value={r.role}
                            onChange={(e) => {
                              const newRole = e.target.value as 'editor' | 'viewer';
                              startTransition(async () => {
                                await updateCollaboratorRole({
                                  noteId,
                                  userId: r.userId,
                                  role: newRole,
                                });
                                refresh();
                              });
                            }}
                            className="bg-background h-7 rounded border px-1.5 text-xs"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Remove"
                            onClick={() =>
                              startTransition(async () => {
                                await removeCollaborator({ noteId, userId: r.userId });
                                refresh();
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs capitalize">{r.role}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-full">
                        <Mail className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.email}</p>
                        <p className="text-muted-foreground text-xs">
                          Invited as {r.role} · expires {new Date(r.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      {isOwner && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Revoke invite"
                          onClick={() =>
                            startTransition(async () => {
                              await revokeInvite({ inviteId: r.inviteId, noteId });
                              refresh();
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </li>
              ))}
              {rows.length === 0 && (
                <li className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
                  <UserRound className="size-4" /> Just you so far.
                </li>
              )}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
