'use client';

/**
 * Icon browser modal.
 *
 * Picks from 14 bundled Iconify collections + emoji. Each collection is
 * lazy-loaded the first time the user switches to it (the JSON blobs are
 * multi-hundred-KB each, so we never ship them all in the initial bundle).
 *
 * The chosen value is an Iconify identifier `"prefix:name"` (e.g.
 * `lucide:book`) or — when the user types an emoji in the Emoji tab — a
 * raw unicode glyph. Passing `null` removes the icon.
 *
 * Recent picks are persisted to localStorage so frequent icons are one
 * click away.
 */

import * as React from 'react';
import { Icon, addCollection, type IconifyJSON } from '@iconify/react';
import { Search, X, Trash2, Clock, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@notai/ui/components/dialog';
import { Input } from '@notai/ui/components/input';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import { cn } from '@notai/lib/utils';

interface Collection {
  prefix: string;
  label: string;
  /** Lazy-load the icons.json blob from the installed @iconify-json/* package. */
  load: () => Promise<IconifyJSON>;
}

// Order matches the tab strip. Keep Lucide first (matches app's UI icons).
const COLLECTIONS: Collection[] = [
  {
    prefix: 'lucide',
    label: 'Lucide',
    load: () => import('@iconify-json/lucide/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'tabler',
    label: 'Tabler',
    load: () => import('@iconify-json/tabler/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'heroicons',
    label: 'Heroicons',
    load: () => import('@iconify-json/heroicons/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'material-symbols',
    label: 'Material',
    load: () =>
      import('@iconify-json/material-symbols/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'mdi',
    label: 'MDI',
    load: () => import('@iconify-json/mdi/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'ph',
    label: 'Phosphor',
    load: () => import('@iconify-json/ph/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'ri',
    label: 'Remix',
    load: () => import('@iconify-json/ri/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'carbon',
    label: 'Carbon',
    load: () => import('@iconify-json/carbon/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'fa6-solid',
    label: 'FA Solid',
    load: () => import('@iconify-json/fa6-solid/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'bi',
    label: 'Bootstrap',
    load: () => import('@iconify-json/bi/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'ion',
    label: 'Ionicons',
    load: () => import('@iconify-json/ion/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'octicon',
    label: 'Octicons',
    load: () => import('@iconify-json/octicon/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'simple-icons',
    label: 'Brands',
    load: () =>
      import('@iconify-json/simple-icons/icons.json').then((m) => m.default as IconifyJSON),
  },
  {
    prefix: 'twemoji',
    label: 'Twemoji',
    load: () => import('@iconify-json/twemoji/icons.json').then((m) => m.default as IconifyJSON),
  },
];

const LS_RECENT = 'notai:icon-picker-recent';
const RECENT_MAX = 24;
/** Cap the rendered grid so massive collections (Tabler/MDI ~5k) don't hang. */
const MAX_RENDER = 400;

const packCache = new Map<string, { names: string[] }>();

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_RECENT);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecent(value: string) {
  if (typeof window === 'undefined') return;
  try {
    const next = [value, ...loadRecent().filter((v) => v !== value)].slice(0, RECENT_MAX);
    window.localStorage.setItem(LS_RECENT, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export interface IconPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string | null;
  onChange: (value: string | null) => void;
  title?: string;
}

export function IconPicker({
  open,
  onOpenChange,
  value,
  onChange,
  title = 'Choose icon',
}: IconPickerProps) {
  const [activePrefix, setActivePrefix] = React.useState<string>('recent');
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [names, setNames] = React.useState<string[]>([]);
  const [emoji, setEmoji] = React.useState('');
  const [recent, setRecent] = React.useState<string[]>([]);

  // Reset to recent tab when opening, refresh recent list from storage.
  React.useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
    setQuery('');
    setActivePrefix('recent');
    setEmoji('');
  }, [open]);

  // Lazy-load the selected collection's icon list.
  React.useEffect(() => {
    if (!open) return;
    if (activePrefix === 'recent' || activePrefix === 'emoji') {
      setNames([]);
      return;
    }
    const col = COLLECTIONS.find((c) => c.prefix === activePrefix);
    if (!col) return;
    const cached = packCache.get(col.prefix);
    if (cached) {
      setNames(cached.names);
      return;
    }
    setLoading(true);
    let cancelled = false;
    col
      .load()
      .then((data) => {
        if (cancelled) return;
        addCollection(data);
        const list = Object.keys(data.icons ?? {});
        packCache.set(col.prefix, { names: list });
        setNames(list);
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePrefix, open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return names.slice(0, MAX_RENDER);
    return names.filter((n) => n.includes(q)).slice(0, MAX_RENDER);
  }, [names, query]);

  const handlePick = (v: string) => {
    pushRecent(v);
    onChange(v);
    onOpenChange(false);
  };

  const handleClear = () => {
    onChange(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 shadow-foreground/10 flex h-[78vh] max-h-[720px] w-full max-w-3xl flex-col gap-3 border p-0 shadow-2xl backdrop-blur-xl sm:rounded-2xl">
        <DialogHeader className="relative border-b px-4 py-3">
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
              className="from-primary to-primary/70 text-primary-foreground shadow-primary/20 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-sm"
            >
              <Sparkles className="size-4" />
            </span>
            <div>
              <DialogTitle className="font-serif text-lg font-semibold tracking-tight">
                {title}
              </DialogTitle>
              <DialogDescription>
                Pick from {COLLECTIONS.length} icon libraries or use any emoji.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b px-3 pb-1 pt-0">
          <TabButton active={activePrefix === 'recent'} onClick={() => setActivePrefix('recent')}>
            <Clock className="size-3.5" /> Recent
          </TabButton>
          {COLLECTIONS.map((c) => (
            <TabButton
              key={c.prefix}
              active={activePrefix === c.prefix}
              onClick={() => setActivePrefix(c.prefix)}
            >
              {c.label}
            </TabButton>
          ))}
          <TabButton active={activePrefix === 'emoji'} onClick={() => setActivePrefix('emoji')}>
            Emoji
          </TabButton>
        </div>

        {/* Search */}
        {activePrefix !== 'recent' && activePrefix !== 'emoji' && (
          <div className="px-3">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons…"
                className="pl-8"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {activePrefix === 'recent' ? (
            <RecentPanel
              recent={recent}
              selected={value}
              onPick={handlePick}
              onEmpty={() => setActivePrefix('lucide')}
            />
          ) : activePrefix === 'emoji' ? (
            <EmojiPanel
              value={emoji}
              setValue={setEmoji}
              onSubmit={() => emoji.trim() && handlePick(emoji.trim())}
            />
          ) : loading ? (
            <div className="text-muted-foreground grid place-items-center py-16 text-sm">
              <Spinner /> Loading {activePrefix}…
            </div>
          ) : (
            <IconGrid
              prefix={activePrefix}
              names={filtered}
              total={names.length}
              selected={value}
              onPick={handlePick}
              truncated={names.length > filtered.length}
              query={query}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
            <Trash2 /> Remove icon
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary ring-primary/25 ring-1'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function IconGrid({
  prefix,
  names,
  total,
  selected,
  onPick,
  truncated,
  query,
}: {
  prefix: string;
  names: string[];
  total: number;
  selected?: string | null;
  onPick: (value: string) => void;
  truncated: boolean;
  query: string;
}) {
  if (names.length === 0) {
    return (
      <p className="text-muted-foreground grid place-items-center py-16 text-sm">
        {query ? `No matches for "${query}".` : 'No icons found.'}
      </p>
    );
  }
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
        {names.map((name) => {
          const id = `${prefix}:${name}`;
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              title={name}
              className={cn(
                'text-foreground/80 hover:bg-accent hover:text-foreground grid aspect-square place-items-center rounded-md transition-colors',
                isSelected && 'bg-primary/15 text-primary ring-primary ring-1',
              )}
            >
              <Icon icon={id} className="size-5" />
            </button>
          );
        })}
      </div>
      {truncated && (
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Showing {names.length} of {total.toLocaleString()} — refine your search to see more.
        </p>
      )}
    </>
  );
}

function RecentPanel({
  recent,
  selected,
  onPick,
  onEmpty,
}: {
  recent: string[];
  selected?: string | null;
  onPick: (value: string) => void;
  onEmpty: () => void;
}) {
  if (recent.length === 0) {
    return (
      <div className="text-muted-foreground grid place-items-center py-16 text-center text-sm">
        <p>No recent icons yet.</p>
        <Button variant="link" size="sm" onClick={onEmpty}>
          Browse Lucide →
        </Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
      {recent.map((id) => {
        const isSelected = selected === id;
        const hasPrefix = id.includes(':');
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            title={id}
            className={cn(
              'text-foreground/80 hover:bg-accent hover:text-foreground grid aspect-square place-items-center rounded-md transition-colors',
              isSelected && 'bg-primary/15 text-primary ring-primary ring-1',
            )}
          >
            {hasPrefix ? (
              <Icon icon={id} className="size-5" />
            ) : (
              <span className="text-lg leading-none">{id}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmojiPanel({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
}) {
  const common = [
    '📝',
    '📒',
    '📚',
    '📖',
    '🗒️',
    '📄',
    '📋',
    '🗂️',
    '📁',
    '📅',
    '⭐',
    '❤️',
    '🔥',
    '💡',
    '✅',
    '☑️',
    '⚡',
    '🎯',
    '🚀',
    '🎨',
    '🧠',
    '🛠️',
    '🧪',
    '🎵',
    '💬',
    '📌',
    '🔒',
    '🔑',
    '🌱',
    '🌍',
    '☕',
    '🏠',
    '💼',
    '📞',
    '🧭',
    '📊',
    '🏷️',
    '🎁',
    '🍎',
    '🌙',
    '☀️',
    '⏰',
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste or type an emoji…"
          maxLength={8}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
        />
        <Button onClick={onSubmit} disabled={!value.trim()}>
          Use
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">Quick pick:</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
        {common.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setValue(e);
              onSubmit();
            }}
            className="hover:bg-accent grid aspect-square place-items-center rounded-md text-xl"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
