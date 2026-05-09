'use client';
import * as React from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Extension } from '@tiptap/core';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { Backlink } from './backlink-extension';
import { Callout } from './callout-extension';
import { ToggleBlock, ToggleSummary, ToggleContent } from './toggle-extension';
import { MathInline, MathBlock } from './math-extension';
import { Mermaid } from './mermaid-extension';
import { SlashMenu } from './slash-menu-extension';
import type { SlashAiContext } from './ai-types';
import { cn } from '@notai/lib/utils';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types as string[],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: { fontSize?: string | null }) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

export interface TextBlockProps {
  fragment: Y.XmlFragment;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
  editable?: boolean;
  placeholder?: string;
  className?: string;
  onFocusEditor?: (editor: Editor | null) => void;
  onReady?: (editor: Editor) => void;
  searchBacklinks?: (q: string) => Promise<Array<{ id: string; title: string }>>;
  createBacklink?: (title: string) => Promise<{ id: string; title: string }>;
  /** Optional AI bridge — enables the `/ai` slash command bar when present. */
  aiContext?: SlashAiContext;
}

/**
 * A single TipTap micro-editor bound to one Y.XmlFragment. Reused for
 * every text block on the canvas; the parent decides positioning and
 * lifecycle. Reports focus changes upward so a shared toolbar can target
 * the active block.
 */
export function TextBlock({
  fragment,
  provider,
  user,
  editable = true,
  placeholder = 'Type / for commands…',
  className,
  onFocusEditor,
  onReady,
  searchBacklinks,
  createBacklink,
  aiContext,
}: TextBlockProps) {
  const editor = useEditor(
    {
      editable,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          history: false,
          bulletList: { HTMLAttributes: { class: 'list-disc pl-6' } },
          orderedList: { HTMLAttributes: { class: 'list-decimal pl-6' } },
          blockquote: {
            HTMLAttributes: { class: 'border-l-2 border-primary/50 pl-4 italic' },
          },
          code: { HTMLAttributes: { class: 'rounded bg-muted px-1.5 py-0.5 text-sm font-mono' } },
          codeBlock: {
            HTMLAttributes: { class: 'rounded-md bg-muted p-3 text-sm font-mono' },
          },
        }),
        Placeholder.configure({ placeholder }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight.configure({ multicolor: true }),
        Typography,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: 'text-primary underline underline-offset-2' },
        }),
        Underline,
        TextStyle,
        Color.configure({ types: ['textStyle'] }),
        FontFamily.configure({ types: ['textStyle'] }),
        FontSize,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Subscript,
        Superscript,
        Image.configure({
          HTMLAttributes: { class: 'rounded-md max-w-full my-3' },
          allowBase64: false,
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: { class: 'tiptap-table' },
          handleWidth: 6,
          cellMinWidth: 56,
          allowTableNodeSelection: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Callout,
        ToggleBlock,
        ToggleSummary,
        ToggleContent,
        MathInline,
        MathBlock,
        Mermaid,
        ...(searchBacklinks ? [Backlink.configure({ searchBacklinks, createBacklink })] : []),
        SlashMenu.configure({ aiContext }),
        Collaboration.configure({ fragment }),
        CollaborationCursor.configure({ provider, user }),
      ],
      editorProps: {
        attributes: {
          class: cn('focus:outline-none', className),
          'data-touch-action': 'pan-y',
        },
      },
      onCreate: ({ editor }) => onReady?.(editor),
      onFocus: ({ editor }) => onFocusEditor?.(editor),
    },
    [fragment, provider, editable],
  );

  React.useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  return <EditorContent editor={editor} />;
}
