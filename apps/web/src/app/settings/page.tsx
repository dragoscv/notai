import { SettingsForm } from '@/components/settings/settings-form';

/**
 * Desktop settings window. Rendered in a dedicated Tauri webview opened by
 * the Rust `open_settings` command. Uses client components for all toggles
 * because every setting is backed by Tauri plugins (store + autostart).
 */
export default function SettingsPage() {
    return (
        <main className="mx-auto max-w-xl px-6 py-8">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">
                    Desktop app preferences. Changes are saved automatically.
                </p>
            </header>
            <SettingsForm />
        </main>
    );
}
