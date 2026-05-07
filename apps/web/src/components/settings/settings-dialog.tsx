'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import {
    User as UserIcon,
    Palette,
    NotebookPen,
    ShieldAlert,
    Download,
    LogOut,
    Monitor,
    Sun,
    Moon,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@notai/ui/components/dialog';
import { Button } from '@notai/ui/components/button';
import { Input } from '@notai/ui/components/input';
import { Label } from '@notai/ui/components/label';
import { Switch } from '@notai/ui/components/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@notai/ui/components/avatar';
import { Separator } from '@notai/ui/components/separator';
import { cn, getInitials } from '@notai/lib/utils';
import { useAppPreferences, type AppPreferences } from '@/lib/preferences';
import { signOutAction } from '@/server/actions/auth';
import { updateProfile, exportUserNotes, deleteAccount } from '@/server/actions/account';

export interface SettingsUser {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

type Section = 'profile' | 'appearance' | 'notes' | 'account';

interface SettingsDialogProps {
    user: SettingsUser;
    open: boolean;
    onOpenChange: (next: boolean) => void;
}

const NAV: Array<{ id: Section; label: string; icon: ReactNode }> = [
    { id: 'profile', label: 'Profile', icon: <UserIcon className="size-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="size-4" /> },
    { id: 'notes', label: 'Notes', icon: <NotebookPen className="size-4" /> },
    { id: 'account', label: 'Account', icon: <ShieldAlert className="size-4" /> },
];

/**
 * Full-featured Settings dialog. Split into four sections:
 *
 *  - Profile: edit display name (server-persisted)
 *  - Appearance: theme + editor column width
 *  - Notes: sort order + spellcheck
 *  - Account: export notes, sign out, delete account
 */
export function SettingsDialog({ user, open, onOpenChange }: SettingsDialogProps) {
    const [section, setSection] = useState<Section>('profile');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Customize your Notai experience. Changes save automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-[180px_1fr] gap-0">
                    <nav className="border-r bg-muted/30 p-2" aria-label="Settings sections">
                        <ul className="space-y-0.5">
                            {NAV.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSection(item.id)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                                            section === item.id
                                                ? 'bg-background font-medium shadow-sm'
                                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                                        )}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <div className="max-h-[60vh] overflow-y-auto p-6">
                        {section === 'profile' && <ProfileSection user={user} />}
                        {section === 'appearance' && <AppearanceSection />}
                        {section === 'notes' && <NotesSection />}
                        {section === 'account' && (
                            <AccountSection user={user} onClose={() => onOpenChange(false)} />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ------------------------------ Profile ---------------------------------- */

function ProfileSection({ user }: { user: SettingsUser }) {
    const [name, setName] = useState(user.name ?? '');
    const [pending, startTransition] = useTransition();

    const dirty = name.trim() !== (user.name ?? '').trim();

    const save = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error('Name cannot be empty');
            return;
        }
        startTransition(async () => {
            try {
                await updateProfile({ name: trimmed });
                toast.success('Profile updated');
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to update profile');
            }
        });
    };

    return (
        <div className="space-y-6">
            <SectionHeading title="Profile" description="How you appear in Notai." />

            <div className="flex items-center gap-4">
                <Avatar className="size-16">
                    {user.image ? <AvatarImage src={user.image} alt={user.name ?? 'User'} /> : null}
                    <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                </Avatar>
                <div className="text-sm text-muted-foreground">
                    Your avatar is provided by your Google account.
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="settings-name">Display name</Label>
                <Input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (dirty && !pending) save();
                        }
                    }}
                    maxLength={80}
                    autoComplete="off"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" value={user.email ?? ''} readOnly disabled />
                <p className="text-xs text-muted-foreground">
                    Email is tied to your Google account and cannot be changed here.
                </p>
            </div>

            <div className="flex justify-end">
                <Button type="button" onClick={save} disabled={!dirty || pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Save changes
                </Button>
            </div>
        </div>
    );
}

/* ----------------------------- Appearance -------------------------------- */

function AppearanceSection() {
    const { theme, setTheme } = useTheme();
    const [prefs, setPrefs] = useAppPreferences();

    return (
        <div className="space-y-6">
            <SectionHeading title="Appearance" description="Theme and editor layout." />

            <div className="space-y-2">
                <Label>Theme</Label>
                <SegmentedControl<'light' | 'dark' | 'system'>
                    value={(theme as 'light' | 'dark' | 'system') ?? 'system'}
                    onChange={(v) => setTheme(v)}
                    options={[
                        { value: 'light', label: 'Light', icon: <Sun className="size-3.5" /> },
                        { value: 'dark', label: 'Dark', icon: <Moon className="size-3.5" /> },
                        { value: 'system', label: 'System', icon: <Monitor className="size-3.5" /> },
                    ]}
                />
            </div>

            <div className="space-y-2">
                <Label>Editor width</Label>
                <SegmentedControl<AppPreferences['editorWidth']>
                    value={prefs.editorWidth}
                    onChange={(v) => setPrefs({ editorWidth: v })}
                    options={[
                        { value: 'narrow', label: 'Narrow' },
                        { value: 'comfortable', label: 'Comfortable' },
                        { value: 'wide', label: 'Wide' },
                    ]}
                />
                <p className="text-xs text-muted-foreground">
                    Controls the maximum width of the note content column.
                </p>
            </div>
        </div>
    );
}

/* -------------------------------- Notes ---------------------------------- */

function NotesSection() {
    const [prefs, setPrefs] = useAppPreferences();

    return (
        <div className="space-y-6">
            <SectionHeading title="Notes" description="Defaults for your notes." />

            <div className="space-y-2">
                <Label>Sort order</Label>
                <SegmentedControl<AppPreferences['noteSort']>
                    value={prefs.noteSort}
                    onChange={(v) => setPrefs({ noteSort: v })}
                    options={[
                        { value: 'updated', label: 'Last updated' },
                        { value: 'created', label: 'Created date' },
                        { value: 'alphabetical', label: 'Alphabetical' },
                    ]}
                />
                <p className="text-xs text-muted-foreground">
                    Applied to the notes list in the sidebar and home view.
                </p>
            </div>

            <Row
                id="settings-spellcheck"
                label="Spellcheck"
                description="Enable the browser's spellchecker inside the editor."
                checked={prefs.spellcheck}
                onCheckedChange={(v) => setPrefs({ spellcheck: v })}
            />
        </div>
    );
}

/* -------------------------------- Account -------------------------------- */

function AccountSection({ user, onClose }: { user: SettingsUser; onClose: () => void }) {
    const [exporting, startExport] = useTransition();
    const [signingOut, startSignOut] = useTransition();
    const [confirmEmail, setConfirmEmail] = useState('');
    const [deleting, startDelete] = useTransition();

    const exportNotes = () => {
        startExport(async () => {
            try {
                const data = await exportUserNotes();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const stamp = new Date().toISOString().slice(0, 10);
                a.download = `notai-export-${stamp}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}`);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Export failed');
            }
        });
    };

    const doSignOut = () => {
        startSignOut(async () => {
            await signOutAction();
        });
    };

    const canDelete =
        !!user.email && confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

    const doDelete = () => {
        if (!canDelete) return;
        startDelete(async () => {
            try {
                await deleteAccount({ confirmEmail: confirmEmail.trim() });
                onClose();
            } catch (err) {
                // deleteAccount calls signOut() which throws a redirect — that's not an error.
                // Only surface real errors here.
                const message = err instanceof Error ? err.message : '';
                if (!message.includes('NEXT_REDIRECT')) {
                    toast.error(message || 'Failed to delete account');
                }
            }
        });
    };

    return (
        <div className="space-y-6">
            <SectionHeading title="Account" description="Your data and session." />

            <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">Export your notes</p>
                        <p className="text-xs text-muted-foreground">
                            Download every note as a JSON file. Includes titles, bodies and
                            metadata.
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={exportNotes} disabled={exporting}>
                        {exporting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Download className="size-4" />
                        )}
                        Export
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">Sign out</p>
                        <p className="text-xs text-muted-foreground">
                            End your session on this device.
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={doSignOut} disabled={signingOut}>
                        {signingOut ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <LogOut className="size-4" />
                        )}
                        Sign out
                    </Button>
                </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Delete account</p>
                    <p className="text-xs text-muted-foreground">
                        Permanently deletes your account and every note you own. This cannot be
                        undone. Type <span className="font-medium">{user.email}</span> to confirm.
                    </p>
                    <Input
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder={user.email ?? ''}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                <DialogFooter className="mt-4 sm:justify-start">
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={doDelete}
                        disabled={!canDelete || deleting}
                    >
                        {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
                        Delete account
                    </Button>
                </DialogFooter>
            </div>
        </div>
    );
}

/* ------------------------------ Shared UI -------------------------------- */

function SectionHeading({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

interface SegmentOption<T extends string> {
    value: T;
    label: string;
    icon?: ReactNode;
}

function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: SegmentOption<T>[];
}) {
    return (
        <div className="inline-flex rounded-md border bg-background p-0.5" role="radiogroup">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={value === opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors',
                        value === opt.value
                            ? 'bg-accent text-accent-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {opt.icon}
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

interface RowProps {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

function Row({ id, label, description, checked, onCheckedChange }: RowProps) {
    return (
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="flex-1 space-y-0.5">
                <Label htmlFor={id} className="font-medium">
                    {label}
                </Label>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

/* ------------------------ Convenience: controlled hook ------------------- */

/** Opens the settings dialog via a shared event so any component can trigger it. */
export const SETTINGS_OPEN_EVENT = 'notai:open-settings';

/** Subscribe to open requests. Useful when the dialog lives in the root layout. */
export function useSettingsOpenRequests(onOpen: () => void) {
    useEffect(() => {
        const handler = () => onOpen();
        window.addEventListener(SETTINGS_OPEN_EVENT, handler);
        return () => window.removeEventListener(SETTINGS_OPEN_EVENT, handler);
    }, [onOpen]);
}

/** Dispatches the "open settings" event. Safe to call from anywhere in the app. */
export function requestOpenSettings() {
    window.dispatchEvent(new Event(SETTINGS_OPEN_EVENT));
}
