import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';

export interface UpdateInfo {
  version: string;
  current_version: string;
  notes?: string | null;
}

export interface UpdateToastLabels {
  available: (version: string) => string;
  youAreOn: (current: string) => string;
  installRestart: string;
  downloading: string;
  updateFailed: (error: string) => string;
  later: string;
  upToDate: (current: string) => string;
}

export const UPDATE_TOAST_ID = 'updater-available';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export function showUpdateAvailableToast(info: UpdateInfo, labels: UpdateToastLabels): void {
  toast(labels.available(info.version), {
    id: UPDATE_TOAST_ID,
    description: info.notes ? truncate(info.notes, 240) : labels.youAreOn(info.current_version),
    duration: Infinity,
    action: {
      label: labels.installRestart,
      onClick: () => {
        toast.loading(labels.downloading, { id: UPDATE_TOAST_ID });
        invoke('install_update').catch((e) => {
          toast.error(labels.updateFailed(String(e)), { id: UPDATE_TOAST_ID, duration: 8000 });
        });
      },
    },
    cancel: { label: labels.later, onClick: () => toast.dismiss(UPDATE_TOAST_ID) },
  });
}

export function showUpToDateToast(currentVersion: string, labels: UpdateToastLabels): void {
  toast.success(labels.upToDate(currentVersion), {
    id: UPDATE_TOAST_ID,
    duration: 4000,
  });
}
