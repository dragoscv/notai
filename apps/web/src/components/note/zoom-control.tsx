'use client';
import * as React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@notai/ui/components/popover';
import { Slider } from '@notai/ui/components/slider';
import { cn } from '@notai/lib/utils';

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.5;
export const ZOOM_DEFAULT = 1;
const ZOOM_STEP = 0.05;

/**
 * Hook: keep the zoom value in localStorage + sync across windows so the
 * sticky honours the last-used zoom on reopen.
 */
export function useZoom(storageKey: string): [number, (z: number) => void] {
    const [zoom, setZoomState] = React.useState(ZOOM_DEFAULT);

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const n = Number(raw);
                if (Number.isFinite(n) && n >= ZOOM_MIN && n <= ZOOM_MAX) setZoomState(n);
            }
        } catch {
            /* ignore */
        }
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey || !e.newValue) return;
            const n = Number(e.newValue);
            if (Number.isFinite(n) && n >= ZOOM_MIN && n <= ZOOM_MAX) setZoomState(n);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [storageKey]);

    const setZoom = React.useCallback(
        (z: number) => {
            const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
            setZoomState(clamped);
            try {
                localStorage.setItem(storageKey, String(clamped));
            } catch {
                /* ignore */
            }
        },
        [storageKey],
    );

    return [zoom, setZoom];
}

/**
 * Compact popover with a zoom slider plus in/out/reset buttons. Matches
 * the visual weight of SurfaceSwitcher so both can live side-by-side.
 */
export function ZoomControl({
    value,
    onChange,
    buttonClassName,
}: {
    value: number;
    onChange: (z: number) => void;
    buttonClassName?: string;
}) {
    const pct = Math.round(value * 100);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    className={cn(
                        'size-6 cursor-pointer hover:bg-current/10 hover:text-current data-[state=open]:bg-current/20',
                        buttonClassName,
                    )}
                    title={`Zoom (${pct}%)`}
                    aria-label={`Zoom ${pct}%`}
                >
                    <ZoomIn className="size-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 space-y-3 p-3">
                <div className="flex items-center justify-between text-xs font-medium">
                    <span>Zoom</span>
                    <span className="tabular-nums text-muted-foreground">{pct}%</span>
                </div>
                <Slider
                    min={ZOOM_MIN * 100}
                    max={ZOOM_MAX * 100}
                    step={ZOOM_STEP * 100}
                    value={[pct]}
                    onValueChange={([next]) => {
                        if (typeof next === 'number') onChange(next / 100);
                    }}
                />
                <div className="flex items-center justify-between gap-1">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => onChange(value - ZOOM_STEP)}
                        disabled={value <= ZOOM_MIN + 0.001}
                    >
                        <ZoomOut /> Out
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onChange(ZOOM_DEFAULT)}
                        title="Reset to 100%"
                        aria-label="Reset zoom"
                    >
                        <RotateCcw />
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => onChange(value + ZOOM_STEP)}
                        disabled={value >= ZOOM_MAX - 0.001}
                    >
                        <ZoomIn /> In
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
