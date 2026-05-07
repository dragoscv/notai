'use client';
import { useState, useTransition } from 'react';
import { Button } from '@notai/ui/components/button';
import { Input } from '@notai/ui/components/input';
import { Label } from '@notai/ui/components/label';
import { createOauthClient } from '@/server/actions/oauth-clients';

export function CreateClientForm() {
    const [pending, start] = useTransition();
    const [created, setCreated] = useState<{ clientId: string; clientSecret: string | null } | null>(null);
    const [error, setError] = useState<string | null>(null);

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const redirectUris = String(fd.get('redirectUris') ?? '')
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        const type = (fd.get('type') as 'confidential' | 'public') ?? 'confidential';
        const name = String(fd.get('name') ?? '').trim();
        const description = String(fd.get('description') ?? '').trim() || undefined;
        const clientUri = String(fd.get('clientUri') ?? '').trim() || undefined;

        if (!name || redirectUris.length === 0) {
            setError('Name and at least one redirect URI are required.');
            return;
        }
        setError(null);
        start(async () => {
            try {
                const result = await createOauthClient({
                    name,
                    redirectUris,
                    type,
                    description,
                    clientUri,
                });
                setCreated(result);
                e.currentTarget?.reset();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not create client.');
            }
        });
    }

    if (created) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="font-serif text-base font-semibold">Client created</h3>
                <p className="text-xs text-muted-foreground">
                    Copy these credentials now — the secret will not be shown again.
                </p>
                <Field label="client_id" value={created.clientId} />
                {created.clientSecret ? (
                    <Field label="client_secret" value={created.clientSecret} secret />
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Public client — no secret. Use PKCE only.
                    </p>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>
                    Register another
                </Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={onSubmit}
            className="space-y-3 rounded-xl border bg-card p-4"
        >
            <h3 className="font-serif text-base font-semibold">Register a new client</h3>

            <div className="space-y-1.5">
                <Label htmlFor="oc-name">App name</Label>
                <Input id="oc-name" name="name" placeholder="metu" required />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="oc-redirects">Redirect URIs</Label>
                <textarea
                    id="oc-redirects"
                    name="redirectUris"
                    rows={3}
                    placeholder="https://metu.example/api/oauth/notai/callback"
                    required
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[11px] text-muted-foreground">
                    One per line. Must match exactly during the flow.
                </p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="oc-type">Client type</Label>
                <select
                    id="oc-type"
                    name="type"
                    defaultValue="confidential"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                    <option value="confidential">Confidential (with secret)</option>
                    <option value="public">Public (PKCE-only)</option>
                </select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="oc-clientUri">Homepage URL (optional)</Label>
                <Input id="oc-clientUri" name="clientUri" placeholder="https://metu.example" />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="oc-description">Description (optional)</Label>
                <Input
                    id="oc-description"
                    name="description"
                    placeholder="What this app does with my notes"
                />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Creating…' : 'Create client'}
            </Button>
        </form>
    );
}

function Field({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
    return (
        <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
            </div>
            <div className="mt-1 flex items-center gap-2">
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">{value}</code>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => navigator.clipboard.writeText(value)}
                >
                    Copy
                </Button>
            </div>
            {secret ? (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500">
                    Store this somewhere safe. It is not shown again.
                </p>
            ) : null}
        </div>
    );
}
