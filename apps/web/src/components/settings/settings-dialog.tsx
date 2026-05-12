'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  User as UserIcon,
  Palette,
  NotebookPen,
  ShieldAlert,
  Download,
  LogOut,
  Monitor,
  Check,
  Loader2,
  PenLine,
  Wand2,
  Plus,
  Trash2,
  KeyRound,
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
import { APP_THEMES } from '@notai/ui/components/theme-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@notai/ui/components/avatar';
import { Separator } from '@notai/ui/components/separator';
import { cn, getInitials } from '@notai/lib/utils';
import { useAppPreferences, type AppPreferences } from '@/lib/preferences';
import { useSnippets, setSnippets } from '@/lib/snippets';
import { ShortcutsEditor } from './shortcuts-editor';
import { signOutAction } from '@/server/actions/auth';
import {
  updateProfile,
  exportUserNotes,
  exportAllUserData,
  deleteAccount,
} from '@/server/actions/account';
import { exportAllNotesAsZip } from '@/server/actions/export-zip';
import { EncryptionSettingsPanel } from './encryption-settings-panel';
import { E2eAuditPanel } from './e2e-audit-panel';
import { importWorkspaceZip } from '@/server/actions/import-zip';
import { importEvernoteEnex } from '@/server/actions/import-enex';
import { exportCalendarIcs } from '@/server/actions/export-ics';

export interface SettingsUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

type Section = 'profile' | 'appearance' | 'notes' | 'snippets' | 'shortcuts' | 'account';

interface SettingsDialogProps {
  user: SettingsUser;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const NAV: Array<{ id: Section; labelKey: string; icon: ReactNode }> = [
  { id: 'profile', labelKey: 'navProfile', icon: <UserIcon className="size-4" /> },
  { id: 'appearance', labelKey: 'navAppearance', icon: <Palette className="size-4" /> },
  { id: 'notes', labelKey: 'navNotes', icon: <NotebookPen className="size-4" /> },
  { id: 'snippets', labelKey: 'navSnippets', icon: <Wand2 className="size-4" /> },
  { id: 'shortcuts', labelKey: 'navShortcuts', icon: <KeyRound className="size-4" /> },
  { id: 'account', labelKey: 'navAccount', icon: <ShieldAlert className="size-4" /> },
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
  const t = useTranslations('settings.dialog');
  const [section, setSection] = useState<Section>('profile');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 shadow-foreground/10 max-w-3xl gap-0 overflow-hidden border p-0 shadow-2xl backdrop-blur-xl sm:max-w-3xl sm:rounded-2xl">
        <DialogHeader className="relative border-b px-6 py-4">
          {/* warm wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                'radial-gradient(420px 140px at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)',
            }}
          />
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="from-primary to-primary/70 text-primary-foreground shadow-primary/20 grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-sm"
            >
              <PenLine className="size-4" />
            </span>
            <div>
              <DialogTitle className="font-serif text-xl font-semibold tracking-tight">
                {t('title')}
              </DialogTitle>
              <DialogDescription>{t('description')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-[180px_1fr] gap-0">
          <nav className="bg-background/40 border-r p-2" aria-label={t('sectionsAria')}>
            <ul className="space-y-0.5">
              {NAV.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      '[&_svg]:text-muted-foreground flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      section === item.id
                        ? 'bg-card text-foreground ring-primary/15 [&_svg]:text-primary font-medium shadow-sm ring-1'
                        : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                    )}
                  >
                    {item.icon}
                    {t(item.labelKey)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="bg-background/30 max-h-[60vh] overflow-y-auto p-6">
            {section === 'profile' && <ProfileSection user={user} />}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'notes' && <NotesSection />}
            {section === 'snippets' && <SnippetsSection />}
            {section === 'shortcuts' && <ShortcutsSection />}
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
  const t = useTranslations('settings.profile');
  const td = useTranslations('settings.dialog');
  const [name, setName] = useState(user.name ?? '');
  const [pending, startTransition] = useTransition();

  const dirty = name.trim() !== (user.name ?? '').trim();

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('nameEmpty'));
      return;
    }
    startTransition(async () => {
      try {
        await updateProfile({ name: trimmed });
        toast.success(t('updated'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('updateFailed'));
      }
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeading title={t('title')} description={t('description')} />

      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {user.image ? <AvatarImage src={user.image} alt={user.name ?? t('userAlt')} /> : null}
          <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="text-muted-foreground text-sm">{t('avatarHint')}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-name">{t('displayName')}</Label>
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
        <Label htmlFor="settings-email">{t('email')}</Label>
        <Input id="settings-email" value={user.email ?? ''} readOnly disabled />
        <p className="text-muted-foreground text-xs">{t('emailHint')}</p>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {td('saveChanges')}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- Appearance -------------------------------- */

function AppearanceSection() {
  const t = useTranslations('settings.appearance');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [prefs, setPrefs] = useAppPreferences();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? theme : null;

  return (
    <div className="space-y-6">
      <SectionHeading title={t('title')} description={t('description')} />

      <div className="space-y-3">
        <Label>{t('theme')}</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ThemeCard
            active={current === 'system'}
            onClick={() => setTheme('system')}
            label={t('themeSystem')}
            mode="auto"
            swatch={['var(--background)', 'var(--primary)']}
            icon={<Monitor className="size-3.5" />}
          />
          {APP_THEMES.map((tt) => {
            const isActive = current === tt.id || (current === 'system' && resolvedTheme === tt.id);
            return (
              <ThemeCard
                key={tt.id}
                active={isActive}
                onClick={() => setTheme(tt.id)}
                label={tt.label}
                mode={tt.mode}
                swatch={tt.swatch}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('editorWidth')}</Label>
        <SegmentedControl<AppPreferences['editorWidth']>
          value={prefs.editorWidth}
          onChange={(v) => setPrefs({ editorWidth: v })}
          options={[
            { value: 'narrow', label: t('narrow') },
            { value: 'comfortable', label: t('comfortable') },
            { value: 'wide', label: t('wide') },
          ]}
        />
        <p className="text-muted-foreground text-xs">{t('editorWidthHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('typography')}</Label>
        <SegmentedControl<AppPreferences['editorTypography']>
          value={prefs.editorTypography}
          onChange={(v) => setPrefs({ editorTypography: v })}
          options={[
            { value: 'serif', label: t('serif') },
            { value: 'sans', label: t('sans') },
            { value: 'rounded', label: t('rounded') },
            { value: 'mono', label: t('mono') },
          ]}
        />
        <p className="text-muted-foreground text-xs">{t('typographyHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('sidebarDensity')}</Label>
        <SegmentedControl<AppPreferences['sidebarDensity']>
          value={prefs.sidebarDensity}
          onChange={(v) => setPrefs({ sidebarDensity: v })}
          options={[
            { value: 'compact', label: t('compact') },
            { value: 'cozy', label: t('cozy') },
            { value: 'spacious', label: t('spacious') },
          ]}
        />
        <p className="text-muted-foreground text-xs">{t('sidebarDensityHint')}</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="dyslexia-font">{t('dyslexiaFont')}</Label>
          <p className="text-muted-foreground text-xs">{t('dyslexiaFontDesc')}</p>
        </div>
        <Switch
          id="dyslexia-font"
          checked={prefs.dyslexiaFont}
          onCheckedChange={(v) => setPrefs({ dyslexiaFont: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="high-contrast">{t('highContrast')}</Label>
          <p className="text-muted-foreground text-xs">{t('highContrastDesc')}</p>
        </div>
        <Switch
          id="high-contrast"
          checked={prefs.highContrast}
          onCheckedChange={(v) => setPrefs({ highContrast: v })}
        />
      </div>
    </div>
  );
}

function ThemeCard({
  active,
  onClick,
  label,
  mode,
  swatch,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  mode: string;
  swatch: readonly [string, string];
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:border-primary/40 group relative flex flex-col gap-2 overflow-hidden rounded-lg border p-2 text-left transition-all hover:shadow-sm',
        active && 'border-primary/70 ring-primary/30 ring-2',
      )}
      aria-pressed={active}
    >
      <span
        aria-hidden
        className="ring-border/50 block h-12 w-full rounded-md ring-1"
        style={{
          background: `linear-gradient(135deg, ${swatch[0]} 55%, ${swatch[1]} 55%)`,
        }}
      />
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {icon}
          <span className="truncate text-xs font-medium">{label}</span>
        </div>
        <span className="text-muted-foreground/70 shrink-0 text-[9px] uppercase tracking-wide">
          {mode}
        </span>
      </div>
      {active && (
        <span className="bg-primary text-primary-foreground absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full shadow">
          <Check className="size-2.5" />
        </span>
      )}
    </button>
  );
}

/* -------------------------------- Notes ---------------------------------- */

function NotesSection() {
  const t = useTranslations('settings.notes');
  const [prefs, setPrefs] = useAppPreferences();

  return (
    <div className="space-y-6">
      <SectionHeading title={t('title')} description={t('description')} />

      <div className="space-y-2">
        <Label>{t('sortOrder')}</Label>
        <SegmentedControl<AppPreferences['noteSort']>
          value={prefs.noteSort}
          onChange={(v) => setPrefs({ noteSort: v })}
          options={[
            { value: 'updated', label: t('sortUpdated') },
            { value: 'created', label: t('sortCreated') },
            { value: 'alphabetical', label: t('sortAlphabetical') },
          ]}
        />
        <p className="text-muted-foreground text-xs">{t('sortHint')}</p>
      </div>

      <Row
        id="settings-spellcheck"
        label={t('spellcheck')}
        description={t('spellcheckDesc')}
        checked={prefs.spellcheck}
        onCheckedChange={(v) => setPrefs({ spellcheck: v })}
      />
    </div>
  );
}

/* -------------------------------- Snippets ------------------------------- */

function SnippetsSection() {
  const t = useTranslations('settings.snippets');
  const snippets = useSnippets();
  const [draft, setDraft] = useState<Array<{ name: string; body: string }>>(() => snippets);
  useEffect(() => {
    setDraft(snippets);
  }, [snippets]);

  const persist = (next: Array<{ name: string; body: string }>) => {
    setDraft(next);
    setSnippets(next);
  };

  return (
    <div className="space-y-6">
      <SectionHeading title={t('title')} description={t('description')} />

      <div className="space-y-2">
        {draft.map((s, i) => (
          <div key={i} className="bg-card/50 flex items-start gap-2 rounded-md border p-2">
            <div className="flex w-32 shrink-0 flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider opacity-70">
                {t('nameLabel')}
              </Label>
              <Input
                value={s.name}
                onChange={(e) => {
                  const copy = [...draft];
                  copy[i] = { ...copy[i]!, name: e.target.value };
                  setDraft(copy);
                }}
                onBlur={() => persist(draft)}
                placeholder={t('namePlaceholder')}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider opacity-70">
                {t('expandsTo')}
              </Label>
              <textarea
                value={s.body}
                onChange={(e) => {
                  const copy = [...draft];
                  copy[i] = { ...copy[i]!, body: e.target.value };
                  setDraft(copy);
                }}
                onBlur={() => persist(draft)}
                rows={2}
                className="bg-background min-h-[2rem] w-full rounded-md border px-2 py-1 font-mono text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mt-5"
              onClick={() => persist(draft.filter((_, j) => j !== i))}
              aria-label={t('deleteAria', { name: s.name })}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => persist([...draft, { name: '', body: '' }])}
        >
          <Plus className="size-3.5" /> {t('addSnippet')}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- Shortcuts ------------------------------ */

function ShortcutsSection() {
  const t = useTranslations('settings.shortcutsSection');
  return (
    <div className="space-y-4">
      <SectionHeading title={t('title')} description={t('description')} />
      <ShortcutsEditor />
    </div>
  );
}

/* -------------------------------- Account -------------------------------- */

function AccountSection({ user, onClose }: { user: SettingsUser; onClose: () => void }) {
  const t = useTranslations('settings.account');
  const [exporting, startExport] = useTransition();
  const [exportingZip, startExportZip] = useTransition();
  const [exportingGdpr, startExportGdpr] = useTransition();
  const [importing, startImport] = useTransition();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importingEnex, startImportEnex] = useTransition();
  const enexInputRef = useRef<HTMLInputElement>(null);
  const [exportingIcs, startExportIcs] = useTransition();
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
        toast.success(
          data.notes.length === 1
            ? t('exportedNotesOne')
            : t('exportedNotesOther', { count: data.notes.length }),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('exportFailed'));
      }
    });
  };

  const exportZip = () => {
    startExportZip(async () => {
      try {
        const { filename, base64, noteCount } = await exportAllNotesAsZip();
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(
          noteCount === 1 ? t('exportedZipOne') : t('exportedZipOther', { count: noteCount }),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('exportFailed'));
      }
    });
  };

  const exportGdpr = () => {
    startExportGdpr(async () => {
      try {
        const data = await exportAllUserData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stamp = new Date().toISOString().slice(0, 10);
        a.download = `notai-gdpr-export-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(t('personalDataDownloaded'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('exportFailed'));
      }
    });
  };

  const doSignOut = () => {
    startSignOut(async () => {
      await signOutAction();
    });
  };

  const exportIcs = () => {
    startExportIcs(async () => {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const { filename, content, eventCount } = await exportCalendarIcs(origin);
        if (eventCount === 0) {
          toast.info(t('icsNoEvents'));
          return;
        }
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(
          eventCount === 1 ? t('icsExportedOne') : t('icsExportedOther', { count: eventCount }),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('icsFailed'));
      }
    });
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('zipTooLarge'));
      return;
    }
    startImport(async () => {
      const tid = toast.loading(t('importingNotes'));
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);
        const summary = await importWorkspaceZip({ filename: file.name, base64 });
        const parts: string[] = [];
        if (summary.notesCreated > 0)
          parts.push(
            summary.notesCreated === 1
              ? t('notesCountOne')
              : t('notesCountOther', { count: summary.notesCreated }),
          );
        if (summary.foldersCreated > 0)
          parts.push(
            summary.foldersCreated === 1
              ? t('foldersCountOne')
              : t('foldersCountOther', { count: summary.foldersCreated }),
          );
        const message =
          parts.length > 0
            ? t('importedSummary', { summary: parts.join(', ') })
            : t('importedNothing');
        toast.success(message, { id: tid });
        if (summary.errors.length > 0) {
          toast.warning(
            t('importIssues', { count: summary.errors.length, first: summary.errors[0]! }),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('importFailed'), { id: tid });
      }
    });
  };

  const onImportEnex = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('enexTooLarge'));
      return;
    }
    startImportEnex(async () => {
      const tid = toast.loading(t('importingEnex'));
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);
        const summary = await importEvernoteEnex({ filename: file.name, base64 });
        const parts: string[] = [];
        if (summary.notesCreated > 0)
          parts.push(
            summary.notesCreated === 1
              ? t('notesCountOne')
              : t('notesCountOther', { count: summary.notesCreated }),
          );
        if (summary.tagsAttached > 0)
          parts.push(
            summary.tagsAttached === 1
              ? t('tagsCountOne')
              : t('tagsCountOther', { count: summary.tagsAttached }),
          );
        const message =
          parts.length > 0
            ? t('importedSummary', { summary: parts.join(', ') })
            : t('importedNothing');
        toast.success(message, { id: tid });
        if (summary.resourcesSkipped > 0) {
          toast.info(
            summary.resourcesSkipped === 1
              ? t('skippedAttachmentsOne')
              : t('skippedAttachmentsOther', { count: summary.resourcesSkipped }),
          );
        }
        if (summary.errors.length > 0) {
          toast.warning(
            t('importIssues', { count: summary.errors.length, first: summary.errors[0]! }),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('importFailed'), { id: tid });
      }
    });
  };

  const canDelete = !!user.email && confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

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
          toast.error(message || t('deleteFailed'));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeading title={t('title')} description={t('description')} />

      <EncryptionSettingsPanel />

      <E2eAuditPanel />

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('exportTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('exportDesc')}</p>
          </div>
          <Button type="button" variant="outline" onClick={exportNotes} disabled={exporting}>
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t('export')}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('gdprTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('gdprDesc')}</p>
          </div>
          <Button type="button" variant="outline" onClick={exportGdpr} disabled={exportingGdpr}>
            {exportingGdpr ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t('download')}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('zipTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('zipDesc')}</p>
          </div>
          <Button type="button" variant="outline" onClick={exportZip} disabled={exportingZip}>
            {exportingZip ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t('downloadZip')}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('importZipTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('importZipDesc')}</p>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={onImportFile}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4 rotate-180" />
            )}
            {t('importZip')}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('enexTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('enexDesc')}</p>
          </div>
          <input
            ref={enexInputRef}
            type="file"
            accept=".enex,application/xml,text/xml"
            onChange={onImportEnex}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => enexInputRef.current?.click()}
            disabled={importingEnex}
          >
            {importingEnex ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4 rotate-180" />
            )}
            {t('enexImport')}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('icsTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('icsDesc')}</p>
          </div>
          <Button type="button" variant="outline" onClick={exportIcs} disabled={exportingIcs}>
            {exportingIcs ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t('icsDownload')}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('signOutTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('signOutDesc')}</p>
          </div>
          <Button type="button" variant="outline" onClick={doSignOut} disabled={signingOut}>
            {signingOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {t('signOut')}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="border-destructive/40 bg-destructive/5 rounded-xl border p-4 backdrop-blur">
        <div className="space-y-2">
          <p className="text-destructive text-sm font-medium">{t('deleteTitle')}</p>
          <p className="text-muted-foreground text-xs">
            {t('deleteDescPrefix')} <span className="font-medium">{user.email}</span>{' '}
            {t('deleteDescSuffix')}
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
            {t('deleteAccount')}
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
      <p className="text-primary inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span className="bg-primary/60 size-1 rounded-full" />
        {title}
      </p>
      <h2 className="mt-1.5 font-serif text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
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
    <div className="bg-card/60 inline-flex rounded-lg border p-0.5 backdrop-blur" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
            value === opt.value
              ? 'bg-background text-foreground ring-primary/15 shadow-sm ring-1'
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
    <div className="bg-card/60 hover:bg-card/80 flex items-start justify-between gap-4 rounded-xl border p-4 backdrop-blur transition-colors">
      <div className="flex-1 space-y-0.5">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{description}</p>
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
