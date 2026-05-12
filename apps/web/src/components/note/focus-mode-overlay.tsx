'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Focus } from 'lucide-react';
import { toast } from 'sonner';

interface ExApiLike {
  getAppState(): { selectedElementIds?: Record<string, boolean> };
  getSceneElementsIncludingDeleted(): readonly AnyEl[];
  updateScene(payload: {
    elements: readonly AnyEl[];
    captureUpdate?: 'NEVER' | 'IMMEDIATELY' | 'EVENTUALLY';
  }): void;
}

interface Props {
  getApi: () => ExApiLike | null;
}

interface AnyEl {
  id: string;
  opacity: number;
}

/**
 * Note-level focus mode. Press `F` on the canvas with one or more
 * elements selected to dim every other element to 20% opacity. Press
 * `Esc` (or `F` again) to restore. Pressing `F` with nothing selected
 * is a no-op — focus mode needs a target.
 *
 * Implementation: snapshots each element's `opacity` at toggle-on,
 * pushes a non-undoable `updateScene` that lowers non-selected
 * opacities, then restores from the snapshot on toggle-off. Excalidraw
 * 0.18 supports `captureUpdate: 'NEVER'` so the dim/restore doesn't
 * pollute the undo stack.
 */
export function FocusModeOverlay({ getApi }: Props) {
  const t = useTranslations('editor.focusMode.overlay');
  const [active, setActive] = React.useState(false);
  const snapshotRef = React.useRef<Map<string, number> | null>(null);

  const exit = React.useCallback(() => {
    const api = getApi();
    if (!api || !snapshotRef.current) {
      setActive(false);
      return;
    }
    const snap = snapshotRef.current;
    const els = api.getSceneElementsIncludingDeleted();
    const next = els.map((el) => {
      const orig = snap.get(el.id);
      if (orig == null || orig === el.opacity) return el;
      return { ...el, opacity: orig } as AnyEl;
    });
    api.updateScene({ elements: next, captureUpdate: 'NEVER' });
    snapshotRef.current = null;
    setActive(false);
  }, [getApi]);

  const enter = React.useCallback(() => {
    const api = getApi();
    if (!api) return;
    const state = api.getAppState();
    const selectedIds = new Set(
      Object.keys(state.selectedElementIds ?? {}).filter((k) => state.selectedElementIds?.[k]),
    );
    if (selectedIds.size === 0) {
      toast.message(t('selectFirst'));
      return;
    }
    const els = api.getSceneElementsIncludingDeleted();
    const snap = new Map<string, number>();
    const next = els.map((el) => {
      snap.set(el.id, el.opacity);
      if (selectedIds.has(el.id)) return el;
      return { ...el, opacity: 20 } as AnyEl;
    });
    snapshotRef.current = snap;
    api.updateScene({ elements: next, captureUpdate: 'NEVER' });
    setActive(true);
  }, [getApi]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (e.key === 'Escape' && active) {
        e.preventDefault();
        exit();
        return;
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (active) exit();
        else enter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, enter, exit]);

  // Restore on unmount so a navigation away never leaves the scene
  // permanently dimmed.
  React.useEffect(
    () => () => {
      if (snapshotRef.current) exit();
    },
    [exit],
  );

  if (!active) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <button
        type="button"
        onClick={() => exit()}
        className="bg-foreground text-background pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs shadow-md"
      >
        <Focus className="size-3.5" />
        {t('banner')} &middot;{' '}
        {t.rich('exitHint', {
          esc: () => <kbd className="font-mono">Esc</kbd>,
          f: () => <kbd className="font-mono">F</kbd>,
        })}
      </button>
    </div>
  );
}
