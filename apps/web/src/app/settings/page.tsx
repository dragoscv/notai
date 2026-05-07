import { PenLine } from 'lucide-react';
import { SettingsForm } from '@/components/settings/settings-form';

/**
 * Desktop settings window. Rendered in a dedicated Tauri webview opened by
 * the Rust `open_settings` command. Uses client components for all toggles
 * because every setting is backed by Tauri plugins (store + autostart).
 */
export default function SettingsPage() {
  return (
    <main className="relative mx-auto min-h-dvh max-w-xl px-6 py-8">
      {/* soft warm wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(600px 240px at 50% 0%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 70%)',
        }}
      />

      <header className="mb-8 flex items-center gap-3">
        <span
          aria-hidden
          className="from-primary to-primary/70 text-primary-foreground shadow-primary/20 grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-sm"
        >
          <PenLine className="size-4" />
        </span>
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Desktop app preferences. Changes are saved automatically.
          </p>
        </div>
      </header>
      <SettingsForm />
    </main>
  );
}
