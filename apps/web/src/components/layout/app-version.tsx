'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isTauri, invoke } from '@/lib/tauri';
import { cn } from '@notai/lib/utils';
import {
  showUpdateAvailableToast,
  showUpToDateToast,
  type UpdateInfo,
  type UpdateToastLabels,
} from './update-toast';

const WEB_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const REALTIME_VERSION = process.env.NEXT_PUBLIC_REALTIME_VERSION ?? '0.0.0';

type CheckState = 'idle' | 'checking' | 'available' | 'uptodate';

export function AppVersion({ collapsed }: { collapsed?: boolean }) {
  const [desktopVersion, setDesktopVersion] = React.useState<string | null>(null);
  const [state, setState] = React.useState<CheckState>('idle');
  const inTauri = isTauri();
  const tUp = useTranslations('sidebarTree.updater');
  const tVer = useTranslations('sidebarTree.version');
  const labels = React.useMemo<UpdateToastLabels>(
    () => ({
      available: (version) => tUp('available', { version }),
      youAreOn: (current) => tUp('youAreOn', { current }),
      installRestart: tUp('installRestart'),
      downloading: tUp('downloading'),
      updateFailed: (error) => tUp('updateFailed', { error }),
      later: tUp('later'),
      upToDate: (current) => tUp('upToDate', { current }),
    }),
    [tUp],
  );

  React.useEffect(() => {
    if (!inTauri) return;
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
  }, [inTauri]);

  // Listen for updater availability emitted by the Rust startup poll so the
  // warning icon shows even without the user clicking refresh.
  React.useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen('updater://available', () => setState('available'));
    })();
    return () => unlisten?.();
  }, [inTauri]);

  // Auto-revert "uptodate" back to idle after 2s so the icon returns to refresh.
  React.useEffect(() => {
    if (state !== 'uptodate') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const onCheck = async () => {
    if (!inTauri || state === 'checking') return;
    setState('checking');
    try {
      const info = await invoke<UpdateInfo | null>('check_for_update');
      if (info) {
        setState('available');
        showUpdateAvailableToast(info, labels);
      } else {
        setState('uptodate');
        showUpToDateToast(desktopVersion ?? WEB_VERSION, labels);
      }
    } catch (err) {
      toast.error(tVer('checkFailed', { error: String(err) }), { duration: 5000 });
      setState('idle');
    }
  };

  const segments = [`web v${WEB_VERSION}`];
  if (inTauri && desktopVersion) segments.push(`app v${desktopVersion}`);
  segments.push(`rt v${REALTIME_VERSION}`);
  const text = segments.join(' · ');

  if (collapsed) {
    return (
      <div
        className="text-muted-foreground/60 px-1 pt-1 text-center text-[9px] leading-tight"
        title={text}
      >
        v{desktopVersion ?? WEB_VERSION}
      </div>
    );
  }

  const Icon = state === 'available' ? AlertTriangle : state === 'uptodate' ? Check : RefreshCw;
  const iconColor =
    state === 'available'
      ? 'text-yellow-500 hover:text-yellow-400'
      : state === 'uptodate'
        ? 'text-green-500'
        : 'text-muted-foreground/70 hover:text-foreground';
  const tooltip =
    state === 'available'
      ? tVer('available')
      : state === 'uptodate'
        ? tVer('upToDate')
        : state === 'checking'
          ? tVer('checking')
          : tVer('check');

  return (
    <div className="text-muted-foreground/70 flex items-center gap-1.5 px-3 pb-1 pt-0.5 text-[10px] leading-tight">
      <span className="truncate" title={text}>
        {text}
      </span>
      {inTauri ? (
        <button
          type="button"
          onClick={onCheck}
          disabled={state === 'checking'}
          className={cn('shrink-0 transition-colors', iconColor)}
          aria-label={tooltip}
          title={tooltip}
        >
          <Icon className={cn('size-3', state === 'checking' && 'animate-spin')} />
        </button>
      ) : null}
    </div>
  );
}
