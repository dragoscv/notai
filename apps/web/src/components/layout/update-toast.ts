import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';

export interface UpdateInfo {
  version: string;
  current_version: string;
  notes?: string | null;
}

export const UPDATE_TOAST_ID = 'updater-available';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export function showUpdateAvailableToast(info: UpdateInfo): void {
  toast(`Notai v${info.version} is available`, {
    id: UPDATE_TOAST_ID,
    description: info.notes ? truncate(info.notes, 240) : `You're on v${info.current_version}.`,
    duration: Infinity,
    action: {
      label: 'Install & restart',
      onClick: () => {
        toast.loading('Downloading update…', { id: UPDATE_TOAST_ID });
        invoke('install_update').catch((e) => {
          toast.error(`Update failed: ${String(e)}`, { id: UPDATE_TOAST_ID, duration: 8000 });
        });
      },
    },
    cancel: { label: 'Later', onClick: () => toast.dismiss(UPDATE_TOAST_ID) },
  });
}

export function showUpToDateToast(currentVersion: string): void {
  toast.success(`You're on the latest version (v${currentVersion})`, {
    id: UPDATE_TOAST_ID,
    duration: 4000,
  });
}
