import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  group: 'basic' | 'lists' | 'blocks' | 'advanced' | 'ai';
  run: (editor: Editor, range: Range) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    hint: 'Large section title',
    keywords: ['h1', 'heading', 'title', 'big'],
    group: 'basic',
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    hint: 'Medium section title',
    keywords: ['h2', 'heading', 'subtitle'],
    group: 'basic',
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    hint: 'Small section title',
    keywords: ['h3', 'heading'],
    group: 'basic',
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'paragraph',
    label: 'Text',
    hint: 'Plain paragraph',
    keywords: ['p', 'paragraph', 'text', 'plain'],
    group: 'basic',
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('paragraph').run(),
  },
  {
    id: 'todo',
    label: 'To-do list',
    hint: 'Track tasks with checkboxes',
    keywords: ['todo', 'task', 'check', 'checkbox', 'list'],
    group: 'lists',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    id: 'bullet',
    label: 'Bullet list',
    hint: 'Simple bulleted list',
    keywords: ['bullet', 'unordered', 'list', 'ul'],
    group: 'lists',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Numbered list',
    hint: '1. 2. 3. ordered list',
    keywords: ['number', 'ordered', 'ol', 'list'],
    group: 'lists',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    hint: 'Capture a citation',
    keywords: ['quote', 'blockquote', 'cite'],
    group: 'blocks',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code block',
    hint: 'Monospace code with syntax',
    keywords: ['code', 'pre', 'mono', '```'],
    group: 'blocks',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    hint: 'Horizontal rule',
    keywords: ['divider', 'hr', 'rule', 'separator', '---'],
    group: 'blocks',
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    id: 'image',
    label: 'Image',
    hint: 'Embed an image by URL',
    keywords: ['image', 'img', 'picture', 'photo'],
    group: 'blocks',
    run: (e, r) => {
      const url = typeof window === 'undefined' ? null : window.prompt('Image URL (https://…)');
      const trimmed = url?.trim();
      if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
        e.chain().focus().deleteRange(r).run();
        return;
      }
      e.chain().focus().deleteRange(r).setImage({ src: trimmed }).run();
    },
  },
  {
    id: 'date',
    label: "Today's date",
    hint: 'Insert YYYY-MM-DD',
    keywords: ['date', 'today', 'day'],
    group: 'basic',
    run: (e, r) => {
      const today = new Date().toISOString().slice(0, 10);
      e.chain().focus().deleteRange(r).insertContent(today).run();
    },
  },
  {
    id: 'time',
    label: 'Current time',
    hint: 'Insert HH:MM',
    keywords: ['time', 'now', 'clock'],
    group: 'basic',
    run: (e, r) => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      e.chain().focus().deleteRange(r).insertContent(`${hh}:${mm}`).run();
    },
  },
  {
    id: 'table',
    label: 'Table',
    hint: '3×3 table you can grow',
    keywords: ['table', 'grid', 'rows', 'columns', 'spreadsheet'],
    group: 'advanced',
    run: (e, r) =>
      e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'callout-info',
    label: 'Callout — Info',
    hint: 'Highlight a tip or warning',
    keywords: ['callout', 'admonition', 'note', 'aside', 'info', 'warn', 'success'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setCallout({ variant: 'info' }).run(),
  },
  {
    id: 'callout-warn',
    label: 'Callout — Warning',
    hint: 'Yellow warning callout',
    keywords: ['callout', 'warn', 'warning', 'caution'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setCallout({ variant: 'warn' }).run(),
  },
  {
    id: 'callout-danger',
    label: 'Callout — Danger',
    hint: 'Red danger callout',
    keywords: ['callout', 'danger', 'error', 'red'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setCallout({ variant: 'danger' }).run(),
  },
  {
    id: 'callout-success',
    label: 'Callout — Success',
    hint: 'Green success callout',
    keywords: ['callout', 'success', 'done', 'green', 'ok'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setCallout({ variant: 'success' }).run(),
  },
  {
    id: 'toggle',
    label: 'Toggle',
    hint: 'Collapsible section',
    keywords: ['toggle', 'details', 'collapse', 'fold', 'expand'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setToggleBlock().run(),
  },
  {
    id: 'math-block',
    label: 'Math block',
    hint: 'KaTeX equation, displayed',
    keywords: ['math', 'katex', 'tex', 'latex', 'formula', 'equation'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setMathBlock('').run(),
  },
  {
    id: 'math-inline',
    label: 'Math (inline)',
    hint: 'Inline KaTeX',
    keywords: ['math', 'inline', 'katex', 'tex', 'latex'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setMathInline('').run(),
  },
  {
    id: 'mermaid',
    label: 'Diagram (Mermaid)',
    hint: 'Flowcharts, sequence, graphs',
    keywords: ['mermaid', 'diagram', 'flowchart', 'graph', 'sequence', 'chart'],
    group: 'advanced',
    run: (e, r) => e.chain().focus().deleteRange(r).setMermaid('').run(),
  },
];

/**
 * `/`-trigger menu with block-conversion shortcuts. Mirrors the Notion
 * pattern. Items are matched against label + keyword aliases, so typing
 * `/check`, `/todo`, or `/task` all surface the to-do list command.
 */
export const SlashMenu = Extension.create({
  name: 'slashMenu',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...makeSlashSuggestion(),
      }),
    ];
  },
});

function makeSlashSuggestion(): Partial<SuggestionOptions<SlashCommand>> {
  return {
    char: '/',
    startOfLine: false,
    allowSpaces: false,
    items: ({ query }) => {
      const q = query.trim().toLowerCase();
      if (!q) return SLASH_COMMANDS;
      return SLASH_COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.toLowerCase().includes(q)),
      );
    },
    command: ({ editor, range, props }) => props.run(editor, range),
    render: () => {
      let component: ReactRenderer<unknown> | null = null;
      let popup: HTMLElement | null = null;

      const updatePosition = (clientRect?: () => DOMRect | null) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
      };

      return {
        onStart: (props) => {
          import('./slash-menu-popover').then(({ SlashMenuPopover }) => {
            component = new ReactRenderer(SlashMenuPopover, {
              props,
              editor: props.editor,
            });
            popup = document.createElement('div');
            popup.style.position = 'absolute';
            popup.style.zIndex = '9999';
            popup.appendChild(component.element);
            document.body.appendChild(popup);
            updatePosition(props.clientRect ?? undefined);
          });
        },
        onUpdate: (props) => {
          component?.updateProps(props);
          updatePosition(props.clientRect ?? undefined);
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            popup?.remove();
            component?.destroy();
            return true;
          }
          const inner = component?.ref as
            | { onKeyDown?: (e: KeyboardEvent) => boolean }
            | null
            | undefined;
          return inner?.onKeyDown?.(props.event) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
          component = null;
          popup = null;
        },
      };
    },
  };
}
