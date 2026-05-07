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
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Extension } from '@tiptap/core';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { cn } from '@notai/lib/utils';

/**
 * FontSize — store font-size on TextStyle marks (tiptap 2.x has no official one).
 */
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

export interface NoteEditorProps {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
  editable?: boolean;
  placeholder?: string;
  className?: string;
  onReady?: (editor: Editor) => void;
  onPlaintextChange?: (text: string) => void;
}

export function NoteEditor({
  doc,
  provider,
  user,
  editable = true,
  placeholder = 'Start writing, or press / for commands…',
  className,
  onReady,
  onPlaintextChange,
}: NoteEditorProps) {
  const editor = useEditor(
    {
      editable,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          history: false, // Yjs handles history
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
        Collaboration.configure({ document: doc }),
        CollaborationCursor.configure({ provider, user }),
      ],
      editorProps: {
        attributes: {
          class: cn('focus:outline-none', 'min-h-[60vh] px-8 py-6', className),
          // S Pen / stylus: treat as regular input (no pan), allow palm rejection via CSS
          'data-touch-action': 'pan-y',
        },
        handleDOMEvents: {
          // Prevent the editor from stealing touch events meant for the drawing layer
          touchstart: () => false,
        },
      },
      onCreate: ({ editor }) => onReady?.(editor),
      onUpdate: ({ editor }) => onPlaintextChange?.(editor.getText()),
    },
    [doc, provider, editable],
  );

  React.useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  return <EditorContent editor={editor} className={cn('w-full', className)} />;
}
