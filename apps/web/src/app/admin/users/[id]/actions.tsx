'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button, Input, Label, Badge } from '@notai/ui';
import {
  suspendUser,
  unsuspendUser,
  adminGrantRole,
  adminRevokeRole,
} from '@/server/actions/admin';
import { Section } from '../../_components/primitives';

const ROLES = ['user', 'support', 'admin', 'super_admin'] as const;

export function UserActions({
  userId,
  status,
  currentRoles,
}: {
  userId: string;
  status: 'active' | 'suspended' | 'deleted';
  currentRoles: string[];
}) {
  const [reason, setReason] = React.useState('');
  const [pending, start] = React.useTransition();
  const [roleToAdd, setRoleToAdd] = React.useState<(typeof ROLES)[number]>('support');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Status">
        <div className="space-y-3 p-5">
          {status === 'active' ? (
            <>
              <div>
                <Label htmlFor="reason">Suspension reason</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Spam, abuse, ToS violation…"
                  className="mt-1.5"
                />
              </div>
              <Button
                variant="destructive"
                disabled={pending || !reason.trim()}
                onClick={() =>
                  start(async () => {
                    try {
                      await suspendUser({ userId, reason: reason.trim() });
                      toast.success('User suspended');
                      setReason('');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to suspend');
                    }
                  })
                }
              >
                Suspend account
              </Button>
            </>
          ) : status === 'suspended' ? (
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await unsuspendUser(userId);
                    toast.success('User reinstated');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed');
                  }
                })
              }
            >
              Reinstate account
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Account deleted.</p>
          )}
        </div>
      </Section>

      <Section title="Roles" description="Grant or revoke platform roles.">
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-1.5">
            {currentRoles.length === 0 ? (
              <span className="text-muted-foreground text-xs">No roles assigned.</span>
            ) : (
              currentRoles.map((r) => (
                <span key={r} className="flex items-center gap-1">
                  <Badge variant="secondary">{r}</Badge>
                  <button
                    onClick={() =>
                      start(async () => {
                        try {
                          await adminRevokeRole({
                            userId,
                            roleName: r as (typeof ROLES)[number],
                          });
                          toast.success(`Revoked ${r}`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed');
                        }
                      })
                    }
                    disabled={pending}
                    className="text-muted-foreground text-xs transition hover:text-rose-500"
                    aria-label={`Revoke ${r}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={roleToAdd}
              onChange={(e) => setRoleToAdd(e.target.value as (typeof ROLES)[number])}
              className="border-input bg-background h-9 rounded-md border px-2.5 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={pending || currentRoles.includes(roleToAdd)}
              onClick={() =>
                start(async () => {
                  try {
                    await adminGrantRole({ userId, roleName: roleToAdd });
                    toast.success(`Granted ${roleToAdd}`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed');
                  }
                })
              }
            >
              Grant role
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
