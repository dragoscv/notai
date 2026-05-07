'use client';
import * as React from 'react';
import { FileText, Rows3, Grid3x3, Columns3, LayoutGrid, Square, Maximize } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@notai/ui/components/popover';
import { Slider } from '@notai/ui/components/slider';
import { cn } from '@notai/lib/utils';

export type Surface = 'plain' | 'ruled' | 'grid' | 'dots' | 'columns';
export type SurfaceCoverage = 'page' | 'full';

export interface SurfaceSettings {
    surface: Surface;
    spacing: number;
    coverage: SurfaceCoverage;
}

const SURFACES: { value: Surface; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'plain', label: 'Plain', icon: FileText },
    { value: 'ruled', label: 'Ruled', icon: Rows3 },
    { value: 'grid', label: 'Grid (math)', icon: Grid3x3 },
    { value: 'dots', label: 'Dots', icon: LayoutGrid },
    { value: 'columns', label: 'Columns', icon: Columns3 },
];

const DEFAULT_KEY = 'notai:surface';
const DEFAULT: SurfaceSettings = { surface: 'plain', spacing: 32, coverage: 'page' };

export function useSurface(
    storageKey: string = DEFAULT_KEY,
): [SurfaceSettings, (s: SurfaceSettings) => void] {
    const [state, setState] = React.useState<SurfaceSettings>(DEFAULT);
    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) setState({ ...DEFAULT, ...JSON.parse(raw) });
        } catch {
            /* ignore */
        }
        // Cross-window/tab sync: if another window changes the same key, pick it up.
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey || !e.newValue) return;
            try {
                setState({ ...DEFAULT, ...JSON.parse(e.newValue) });
            } catch {
                /* ignore */
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [storageKey]);
    const set = React.useCallback(
        (next: SurfaceSettings) => {
            setState(next);
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                /* ignore */
            }
        },
        [storageKey],
    );
    return [state, set];
}

export function SurfaceSwitcher({
    value,
    onChange,
}: {
    value: SurfaceSettings;
    onChange: (next: SurfaceSettings) => void;
}) {
    const current = SURFACES.find((s) => s.value === value.surface) ?? SURFACES[0]!;
    const Icon = current.icon;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 cursor-pointer gap-1.5 px-2 text-xs hover:bg-current/10 hover:text-current data-[state=open]:bg-current/20"
                    title="Page style"
                >
                    <Icon className="size-3.5" />
                    <span>{current.label}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 space-y-3 p-3">
                <div>
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">Page style</div>
                    <div className="grid grid-cols-5 gap-1">
                        {SURFACES.map((s) => {
                            const I = s.icon;
                            const active = s.value === value.surface;
                            return (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => onChange({ ...value, surface: s.value })}
                                    title={s.label}
                                    aria-label={s.label}
                                    className={cn(
                                        'flex aspect-square items-center justify-center rounded-md border transition',
                                        active
                                            ? 'border-primary bg-accent text-accent-foreground'
                                            : 'border-border hover:bg-accent',
                                    )}
                                >
                                    <I className="size-4" />
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">Coverage</div>
                    <div className="grid grid-cols-2 gap-1">
                        {(
                            [
                                { value: 'page', label: 'Page', icon: Square },
                                { value: 'full', label: 'Full', icon: Maximize },
                            ] as const
                        ).map((opt) => {
                            const I = opt.icon;
                            const active = opt.value === value.coverage;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => onChange({ ...value, coverage: opt.value })}
                                    title={opt.label}
                                    className={cn(
                                        'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition',
                                        active
                                            ? 'border-primary bg-accent text-accent-foreground'
                                            : 'border-border hover:bg-accent',
                                    )}
                                >
                                    <I className="size-3.5" />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">Line spacing</span>
                        <span className="tabular-nums">{value.spacing}px</span>
                    </div>
                    <Slider
                        min={16}
                        max={64}
                        step={2}
                        value={[value.spacing]}
                        onValueChange={([v]) => onChange({ ...value, spacing: v ?? 32 })}
                        disabled={value.surface === 'plain'}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
