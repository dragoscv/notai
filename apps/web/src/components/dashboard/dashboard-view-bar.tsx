'use client';
import * as React from 'react';
import {
  ChevronDown,
  Filter as FilterIcon,
  Search,
  ArrowUpDown,
  Check,
  Plus,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Input } from '@notai/ui/components/input';
import { Switch } from '@notai/ui/components/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@notai/ui/components/dropdown-menu';
import { Badge } from '@notai/ui/components/badge';
import { cn } from '@notai/lib/utils';
import { usePrompt } from '@/components/ui/prompt-dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  type ViewSpec,
  type FilterSpec,
  type SortKey,
  type UpdatedWithin,
  sortKeys,
  updatedWithinValues,
} from '@/lib/view-spec';
import {
  saveDashboardView,
  deleteDashboardView,
  setDefaultDashboardView,
  renameDashboardView,
  type SavedView,
} from '@/server/actions/views';
import type { Folder } from '@notai/db/schema';

export type DashboardTag = { id: string; name: string; color: string | null };

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Recently updated',
  created: 'Recently created',
  opened: 'Recently opened',
  alphabetical: 'Alphabetical (A→Z)',
  custom: 'Custom (drag to reorder)',
};

const UPDATED_WITHIN_LABELS: Record<UpdatedWithin, string> = {
  any: 'Any time',
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

const COLORS = ['default', 'yellow', 'pink', 'blue', 'green', 'purple', 'orange'] as const;

function countActiveFilters(f: FilterSpec): number {
  let n = 0;
  if (f.folderIds.length) n++;
  if (f.tagIds.length) n++;
  if (f.kinds.length) n++;
  if (f.status.length) n++;
  if (f.colors.length) n++;
  if (f.hasCollaborators) n++;
  if (f.updatedWithin !== 'any') n++;
  if (f.search.trim()) n++;
  return n;
}

export function DashboardViewBar({
  views,
  activeId,
  spec,
  isDirty,
  onSelectView,
  onChangeSpec,
  folders,
  tags,
}: {
  views: SavedView[];
  activeId: string;
  spec: ViewSpec;
  isDirty: boolean;
  onSelectView: (id: string) => void;
  onChangeSpec: (next: ViewSpec) => void;
  folders: Folder[];
  tags: DashboardTag[];
}) {
  const active = views.find((v) => v.id === activeId);
  const activeName = active?.name ?? 'Default';
  const filterCount = countActiveFilters(spec.filters);
  const { prompt, dialog: promptDialog } = usePrompt();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [pending, startTransition] = React.useTransition();

  const updateFilter = (patch: Partial<FilterSpec>) => {
    onChangeSpec({ ...spec, filters: { ...spec.filters, ...patch } });
  };

  const onSaveAs = () => {
    prompt({
      title: 'Save view',
      label: 'Name',
      placeholder: 'My favorites',
      maxLength: 50,
      onSubmit: async (name) => {
        await saveDashboardView({ name, spec });
        toast.success(`View "${name}" saved`);
      },
    });
  };

  const onUpdate = () => {
    if (active?.id === '__default__' || !active) {
      onSaveAs();
      return;
    }
    startTransition(async () => {
      try {
        await saveDashboardView({ id: active.id, name: active.name, spec });
        toast.success(`View "${active.name}" updated`);
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  const onRename = () => {
    if (!active || active.id === '__default__') return;
    prompt({
      title: 'Rename view',
      label: 'Name',
      defaultValue: active.name,
      maxLength: 50,
      onSubmit: async (name) => {
        await renameDashboardView({ id: active.id, name });
      },
    });
  };

  const onDelete = () => {
    if (!active || active.id === '__default__') return;
    confirm({
      title: `Delete view "${active.name}"?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await deleteDashboardView(active.id);
        toast.success('View deleted');
      },
    });
  };

  const onMakeDefault = () => {
    if (!active || active.id === '__default__') return;
    startTransition(async () => {
      await setDefaultDashboardView(active.id);
      toast.success(`"${active.name}" is now your default view`);
    });
  };

  return (
    <div className="bg-background/70 sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b px-4 py-2 backdrop-blur md:px-6">
      {/* View selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            {active?.isDefault ? <Star className="size-3.5 fill-current text-yellow-500" /> : null}
            {activeName}
            {isDirty ? <span className="text-muted-foreground/80">•</span> : null}
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Views</DropdownMenuLabel>
          {views.map((v) => (
            <DropdownMenuItem key={v.id} onSelect={() => onSelectView(v.id)}>
              <span className="flex-1 truncate">{v.name}</span>
              {v.id === activeId ? <Check className="size-4" /> : null}
              {v.isDefault ? <Star className="size-3 fill-current text-yellow-500" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {active && active.id !== '__default__' ? (
            <>
              <DropdownMenuItem onSelect={onRename}>
                <Pencil className="size-4" /> Rename current
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onMakeDefault} disabled={active.isDefault}>
                <Star className="size-4" /> Make default
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete current
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onSelect={onSaveAs}>
            <Plus className="size-4" /> Save as new view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowUpDown className="size-3.5" />
            <span className="hidden sm:inline">{SORT_LABELS[spec.sort]}</span>
            <span className="sm:hidden">Sort</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {sortKeys.map((k) => (
            <DropdownMenuItem key={k} onSelect={() => onChangeSpec({ ...spec, sort: k })}>
              <span className="flex-1">{SORT_LABELS[k]}</span>
              {spec.sort === k ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <span className="flex-1">Pinned first</span>
            <Switch
              checked={spec.pinnedFirst}
              onCheckedChange={(v) => onChangeSpec({ ...spec, pinnedFirst: v })}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FilterIcon className="size-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 ? (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {filterCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,340px)] p-0">
          <div className="max-h-[70vh] overflow-y-auto p-3">
            <FilterSection label="Search">
              <div className="relative">
                <Search className="text-muted-foreground absolute left-2 top-1/2 size-3.5 -translate-y-1/2" />
                <Input
                  value={spec.filters.search}
                  onChange={(e) => updateFilter({ search: e.target.value })}
                  placeholder="Title or content…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </FilterSection>

            <FilterSection label="Status">
              <ChipGroup
                options={[
                  { value: 'pinned', label: 'Pinned' },
                  { value: 'pinnedOnToday', label: 'On Today' },
                  { value: 'favorite', label: 'Favorite' },
                  { value: 'archived', label: 'Archived' },
                ]}
                selected={spec.filters.status}
                onChange={(next) => updateFilter({ status: next as FilterSpec['status'] })}
              />
            </FilterSection>

            <FilterSection label="Kind">
              <ChipGroup
                options={[
                  { value: 'note', label: 'Notes' },
                  { value: 'sticky', label: 'Stickies' },
                ]}
                selected={spec.filters.kinds}
                onChange={(next) => updateFilter({ kinds: next as FilterSpec['kinds'] })}
              />
            </FilterSection>

            <FilterSection label="Updated">
              <ChipGroup
                options={updatedWithinValues.map((v) => ({
                  value: v,
                  label: UPDATED_WITHIN_LABELS[v],
                }))}
                selected={[spec.filters.updatedWithin]}
                onChange={(next) =>
                  updateFilter({
                    updatedWithin: (next[next.length - 1] ?? 'any') as UpdatedWithin,
                  })
                }
                singleSelect
              />
            </FilterSection>

            {folders.length > 0 ? (
              <FilterSection label="Folders">
                <ChipGroup
                  options={[
                    { value: '__root__', label: 'No folder' },
                    ...folders.map((f) => ({ value: f.id, label: f.name })),
                  ]}
                  selected={spec.filters.folderIds.map((f) => (f === null ? '__root__' : f))}
                  onChange={(next) =>
                    updateFilter({
                      folderIds: next.map((v) => (v === '__root__' ? null : v)),
                    })
                  }
                />
              </FilterSection>
            ) : null}

            {tags.length > 0 ? (
              <FilterSection label="Tags">
                <ChipGroup
                  options={tags.map((t) => ({ value: t.id, label: `#${t.name}` }))}
                  selected={spec.filters.tagIds}
                  onChange={(next) => updateFilter({ tagIds: next })}
                />
              </FilterSection>
            ) : null}

            <FilterSection label="Color">
              <ChipGroup
                options={COLORS.map((c) => ({
                  value: c,
                  label: c.charAt(0).toUpperCase() + c.slice(1),
                }))}
                selected={spec.filters.colors}
                onChange={(next) => updateFilter({ colors: next })}
              />
            </FilterSection>

            <FilterSection label="Other">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={!!spec.filters.hasCollaborators}
                  onCheckedChange={(v) => updateFilter({ hasCollaborators: v || undefined })}
                />
                <span>Has collaborators</span>
              </label>
            </FilterSection>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChangeSpec({
                    ...spec,
                    filters: {
                      folderIds: [],
                      tagIds: [],
                      kinds: [],
                      status: [],
                      colors: [],
                      hasCollaborators: undefined,
                      updatedWithin: 'any',
                      search: '',
                    },
                  })
                }
              >
                Reset
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Save / Save as */}
      {isDirty ? (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onSaveAs}>
            Save as new
          </Button>
          {active && active.id !== '__default__' ? (
            <Button size="sm" disabled={pending} onClick={onUpdate}>
              Update view
            </Button>
          ) : (
            <Button size="sm" onClick={onSaveAs}>
              Save view
            </Button>
          )}
        </div>
      ) : null}

      {promptDialog}
      {confirmDialog}
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-muted-foreground mb-1.5 text-[11px] font-medium uppercase tracking-wide">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onChange,
  singleSelect,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  singleSelect?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              if (singleSelect) {
                onChange([o.value]);
                return;
              }
              onChange(active ? selected.filter((s) => s !== o.value) : [...selected, o.value]);
            }}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent text-muted-foreground border-border',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
