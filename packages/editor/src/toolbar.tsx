'use client';
import * as React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Highlighter,
  Link as LinkIcon,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Palette,
  Baseline,
  Superscript as SuperIcon,
  Subscript as SubIcon,
  Minus,
  ChevronDown,
  AArrowDown,
  AArrowUp,
} from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Separator } from '@notai/ui/components/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@notai/ui/components/dropdown-menu';
import { cn } from '@notai/lib/utils';

export interface ToolbarProps {
  editor: Editor | null;
  className?: string;
}

const FONTS = [
  { label: 'Sans', value: '' },
  { label: 'Serif', value: 'var(--font-serif)' },
  { label: 'Mono', value: 'var(--font-mono)' },
  { label: 'System', value: 'system-ui, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
];

const SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px'];

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Peach', value: '#fed7aa' },
  { name: 'Rose', value: '#fecdd3' },
  { name: 'Mint', value: '#bbf7d0' },
  { name: 'Sky', value: '#bae6fd' },
  { name: 'Lavender', value: '#ddd6fe' },
  { name: 'Neutral', value: '#e5e7eb' },
  { name: 'Dark', value: '#374151' },
];

export function Toolbar({ editor, className }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div
      className={cn(
        'bg-card/60 flex flex-wrap items-center gap-0.5 rounded-lg border p-1 backdrop-blur',
        className,
      )}
    >
      <FontDropdown editor={editor} />
      <SizeDropdown editor={editor} />
      <TB onClick={() => adjustFontSize(editor, -1)} label="Decrease font size">
        <AArrowDown />
      </TB>
      <TB onClick={() => adjustFontSize(editor, 1)} label="Increase font size">
        <AArrowUp />
      </TB>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TB
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <Bold />
      </TB>
      <TB
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <Italic />
      </TB>
      <TB
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
      >
        <UnderlineIcon />
      </TB>
      <TB
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
      >
        <Strikethrough />
      </TB>
      <TB
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Inline code"
      >
        <Code />
      </TB>

      <ColorPicker
        icon={<Baseline />}
        label="Text color"
        colors={TEXT_COLORS}
        current={editor.getAttributes('textStyle').color as string | undefined}
        onPick={(c) =>
          c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run()
        }
      />
      <ColorPicker
        icon={<Highlighter />}
        label="Highlight"
        colors={HIGHLIGHT_COLORS}
        current={editor.getAttributes('highlight').color as string | undefined}
        onPick={(c) =>
          c
            ? editor.chain().focus().setHighlight({ color: c }).run()
            : editor.chain().focus().unsetHighlight().run()
        }
      />

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TB
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Heading 1"
      >
        <Heading1 />
      </TB>
      <TB
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        <Heading2 />
      </TB>
      <TB
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Heading 3"
      >
        <Heading3 />
      </TB>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TB
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        label="Align left"
      >
        <AlignLeft />
      </TB>
      <TB
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        label="Align center"
      >
        <AlignCenter />
      </TB>
      <TB
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        label="Align right"
      >
        <AlignRight />
      </TB>
      <TB
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        label="Justify"
      >
        <AlignJustify />
      </TB>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TB
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        <List />
      </TB>
      <TB
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Ordered list"
      >
        <ListOrdered />
      </TB>
      <TB
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        label="Task list"
      >
        <ListChecks />
      </TB>
      <TB
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Quote"
      >
        <Quote />
      </TB>
      <TB
        active={editor.isActive('subscript')}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        label="Subscript"
      >
        <SubIcon />
      </TB>
      <TB
        active={editor.isActive('superscript')}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        label="Superscript"
      >
        <SuperIcon />
      </TB>
      <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Divider">
        <Minus />
      </TB>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TB
        onClick={() => {
          const url = window.prompt('URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        label="Link"
      >
        <LinkIcon />
      </TB>

      <div className="ml-auto flex items-center gap-0.5">
        <TB
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          label="Clear formatting"
        >
          <Type className="opacity-60" />
        </TB>
        <TB
          onClick={() => editor.chain().focus().undo().run()}
          label="Undo"
          disabled={!editor.can().undo()}
        >
          <Undo2 />
        </TB>
        <TB
          onClick={() => editor.chain().focus().redo().run()}
          label="Redo"
          disabled={!editor.can().redo()}
        >
          <Redo2 />
        </TB>
      </div>
    </div>
  );
}

function TB({
  active,
  label,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(active && 'bg-accent text-accent-foreground')}
    >
      {children}
    </Button>
  );
}

function FontDropdown({ editor }: { editor: Editor }) {
  const current = editor.getAttributes('textStyle').fontFamily as string | undefined;
  const label = FONTS.find((f) => f.value === (current ?? ''))?.label ?? 'Custom';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" title="Font family">
          <span className="max-w-20 truncate">{label}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {FONTS.map((f) => (
          <DropdownMenuItem
            key={f.label}
            onClick={() =>
              f.value
                ? editor.chain().focus().setFontFamily(f.value).run()
                : editor.chain().focus().unsetFontFamily().run()
            }
            style={{ fontFamily: f.value || undefined }}
          >
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const DEFAULT_FONT_SIZE_PX = 16;

function adjustFontSize(editor: Editor, delta: number) {
  const current = editor.getAttributes('textStyle').fontSize as string | undefined;
  const parsed = current ? parseInt(current, 10) : NaN;
  const base = Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE_PX;
  const idx = SIZES.findIndex((s) => parseInt(s, 10) === base);
  let next: string;
  if (idx !== -1) {
    const target = Math.max(0, Math.min(SIZES.length - 1, idx + delta));
    next = SIZES[target]!;
  } else {
    const target = Math.max(8, Math.min(96, base + delta * 2));
    next = `${target}px`;
  }
  editor.chain().focus().setMark('textStyle', { fontSize: next }).run();
}

function SizeDropdown({ editor }: { editor: Editor }) {
  const current = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" title="Font size">
          <span>{current || 'Size'}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-24">
        <DropdownMenuItem
          onClick={() => editor.chain().focus().setMark('textStyle', { fontSize: null }).run()}
        >
          Default
        </DropdownMenuItem>
        {SIZES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => editor.chain().focus().setMark('textStyle', { fontSize: s }).run()}
          >
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColorPicker({
  icon,
  label,
  colors,
  current,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  colors: { name: string; value: string }[];
  current?: string;
  onPick: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant="ghost" title={label} aria-label={label}>
          <span className="relative">
            {icon}
            {current ? (
              <span
                className="absolute -bottom-1 left-0 h-1 w-full rounded"
                style={{ background: current }}
              />
            ) : null}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onPick(c.value)}
              title={c.name}
              aria-label={c.name}
              className={cn(
                'ring-border size-6 rounded-md ring-1 transition hover:scale-110',
                c.value === current && 'ring-primary ring-2',
                !c.value && 'bg-transparent',
              )}
              style={{ background: c.value || 'transparent' }}
            >
              {!c.value && <Palette className="mx-auto size-3 opacity-60" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
