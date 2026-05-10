'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { isTauri, invoke } from '@/lib/tauri';

interface UpdateInfo {
  version: string;
  current_version: string;
  notes?: string | null;
}

const WEB_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

export function AppVersion({ collapsed }: { collapsed?: boolean }) {
  const [desktopVersion, setDesktopVersion] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const v = await getVersion();
        if (!cancelled) setDesktopVersion(v);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (collapsed) {
    return (
      <div
        className="text-muted-foreground/60 px-1 pt-1 text-center text-[9px] leading-tight"
        title={
          desktopVersion ? `App v${desktopVersion} • Web v${WEB_VERSION}` : `Web v${WEB_VERSION}`
        }
      >
        v{desktopVersion ?? WEB_VERSION}
      </div>
    );
  }

  const onCheck = async () => {
    if (!isTauri() || checking) return;
    setChecking(true);
    try {
      const info = await invoke<UpdateInfo | null>('check_for_update');
      if (!info) {
        toast.success("You're on the latest version", { duration: 3000 });
      }
      // If an update IS available, the existing AppUpdater listener shows
      // the install toast — no need to duplicate it here.
    } catch (err) {
      toast.error(`Update check failed: ${String(err)}`, { duration: 5000 });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="text-muted-foreground/70 px-3 pb-1 pt-0.5 text-[10px] leading-tight">
      <div>Web v{WEB_VERSION}</div>
      {desktopVersion ? (
        <div className="flex items-center justify-between gap-2">
          <span>App v{desktopVersion}</span>
          <button
            type="button"
            onClick={onCheck}
            disabled={checking}
            className="hover:text-foreground underline-offset-2 transition-colors hover:underline disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
