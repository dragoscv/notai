'use client';

import * as React from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import {
  listNoteProperties,
  setNoteProperty,
  removeNoteProperty,
  listPropertyKeys,
  type NotePropertyDTO,
} from '@/server/actions/note-properties';

const VALUE_TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'url'] as const;
type ValueType = (typeof VALUE_TYPES)[number];

/**
 * Per-note structured properties panel. Collapsed by default; expands
 * once a note has any properties or the user clicks "Add property".
 * Save-on-blur keeps the surface quiet.
 */
export function NotePropertiesPanel({ noteId }: { noteId: string }) {
  const [open, setOpen] = React.useState(false);
  const [props, setProps] = React.useState<NotePropertyDTO[] | null>(null);
  const [keysCache, setKeysCache] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listNoteProperties(noteId);
        if (!cancelled) {
          setProps(list);
          if (list.length > 0) setOpen(true);
        }
      } catch {
        if (!cancelled) setProps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  React.useEffect(() => {
    if (!open || keysCache.length > 0) return;
    void listPropertyKeys()
      .then((rows) => setKeysCache(rows.map((r) => r.key)))
      .catch(() => undefined);
  }, [open, keysCache.length]);

  if (props == null) return null;

  async function save(p: NotePropertyDTO) {
    try {
      await setNoteProperty({
        noteId,
        key: p.key,
        valueType: p.valueType,
        valueText: p.valueText,
        valueNumber: p.valueNumber,
        valueDate: p.valueDate,
        valueBool: p.valueBool,
      });
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save');
    }
  }

  async function remove(key: string) {
    setProps((s) => (s ?? []).filter((p) => p.key !== key));
    try {
      await removeNoteProperty({ noteId, key });
    } catch (err) {
      toast.error((err as Error).message || 'Failed to remove');
    }
  }

  function addBlank() {
    setProps((s) => [
      ...(s ?? []),
      {
        id: `tmp-${Date.now()}`,
        key: '',
        valueType: 'text',
        valueText: '',
        valueNumber: null,
        valueDate: null,
        valueBool: null,
        position: (s?.length ?? 0) + 1,
      },
    ]);
    setOpen(true);
  }

  return (
    <div className="border-border/60 my-3 rounded-xl border">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Properties
        <span className="ml-1">({props.length})</span>
      </button>
      {open && (
        <div className="space-y-1.5 px-3 pb-3">
          {props.map((p) => (
            <PropertyRow
              key={p.id}
              prop={p}
              keysCache={keysCache}
              onChange={(next) => {
                setProps((s) => (s ?? []).map((x) => (x.id === p.id ? { ...x, ...next } : x)));
              }}
              onCommit={(next) => {
                if (!next.key.trim()) return;
                void save({ ...p, ...next });
              }}
              onRemove={() => {
                if (p.key) void remove(p.key);
                else setProps((s) => (s ?? []).filter((x) => x.id !== p.id));
              }}
            />
          ))}
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={addBlank}>
            <Plus className="size-3.5" />
            Add property
          </Button>
        </div>
      )}
    </div>
  );
}

function PropertyRow({
  prop,
  keysCache,
  onChange,
  onCommit,
  onRemove,
}: {
  prop: NotePropertyDTO;
  keysCache: string[];
  onChange: (patch: Partial<NotePropertyDTO>) => void;
  onCommit: (next: NotePropertyDTO) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[140px_90px_1fr_auto] items-center gap-2">
      <input
        list="notai-prop-keys"
        className="border-input bg-background w-full rounded-md border px-2 py-1 text-xs"
        placeholder="Key"
        value={prop.key}
        onChange={(e) => onChange({ key: e.target.value })}
        onBlur={() => onCommit(prop)}
        maxLength={60}
      />
      <select
        className="border-input bg-background w-full rounded-md border px-1.5 py-1 text-xs"
        value={prop.valueType}
        onChange={(e) => {
          const next = e.target.value as ValueType;
          onChange({
            valueType: next,
            valueText: null,
            valueNumber: null,
            valueDate: null,
            valueBool: next === 'checkbox' ? false : null,
          });
          onCommit({
            ...prop,
            valueType: next,
            valueText: null,
            valueNumber: null,
            valueDate: null,
            valueBool: next === 'checkbox' ? false : null,
          });
        }}
      >
        {VALUE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <ValueInput prop={prop} onChange={onChange} onCommit={() => onCommit(prop)} />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-1.5"
        onClick={onRemove}
        aria-label="Remove property"
      >
        <Trash2 className="size-3.5" />
      </Button>
      <datalist id="notai-prop-keys">
        {keysCache.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </div>
  );
}

function ValueInput({
  prop,
  onChange,
  onCommit,
}: {
  prop: NotePropertyDTO;
  onChange: (patch: Partial<NotePropertyDTO>) => void;
  onCommit: () => void;
}) {
  const cls = 'border-input bg-background w-full rounded-md border px-2 py-1 text-xs';
  switch (prop.valueType) {
    case 'number':
      return (
        <input
          type="number"
          className={cls}
          value={prop.valueNumber ?? ''}
          onChange={(e) =>
            onChange({ valueNumber: e.target.value === '' ? null : Number(e.target.value) })
          }
          onBlur={onCommit}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className={cls}
          value={prop.valueDate ? prop.valueDate.slice(0, 10) : ''}
          onChange={(e) =>
            onChange({
              valueDate: e.target.value
                ? new Date(`${e.target.value}T00:00:00.000Z`).toISOString()
                : null,
            })
          }
          onBlur={onCommit}
        />
      );
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={prop.valueBool ?? false}
          onChange={(e) => {
            onChange({ valueBool: e.target.checked });
            onCommit();
          }}
        />
      );
    case 'url':
      return (
        <input
          type="url"
          className={cls}
          value={prop.valueText ?? ''}
          placeholder="https://"
          onChange={(e) => onChange({ valueText: e.target.value })}
          onBlur={onCommit}
        />
      );
    case 'select':
    case 'text':
    default:
      return (
        <input
          type="text"
          className={cls}
          value={prop.valueText ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          onBlur={onCommit}
        />
      );
  }
}
