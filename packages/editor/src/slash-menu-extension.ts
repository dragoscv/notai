import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  group: 'basic' | 'lists' | 'blocks';
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
