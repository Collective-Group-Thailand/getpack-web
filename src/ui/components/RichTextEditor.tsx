"use client";

import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import type { IconName } from "../icons";
import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";

export type RichTextDocument = JSONContent;

export interface RichTextLabels {
  toolbar: string;
  bold: string;
  italic: string;
  heading2: string;
  heading3: string;
  bulletList: string;
  orderedList: string;
  quote: string;
  undo: string;
  redo: string;
}

export interface RichTextEditorProps {
  /** A ProseMirror / TipTap document — the `body` the CMS stores (`{ type: "doc", content }`). */
  value: RichTextDocument | null;
  onChange: (value: RichTextDocument) => void;
  /** Accessible name of the editing area. */
  label: string;
  labels: RichTextLabels;
  id?: string;
  className?: string;
}

/**
 * Rich text for the CMS (F2 2.5 "articles (TipTap)"): headings, emphasis, lists and quotes —
 * what an article needs and nothing that would let an editor restyle the storefront. The
 * document is the editor's own JSON, stored as the API's `body`; the storefront renders it with
 * the same `.pk-richtext` typography.
 *
 * Deliberately not exported from `src/ui/index.ts`: TipTap is a large dependency only the back
 * office loads, and a barrel export would put it within reach of every zone's bundle.
 */
export function RichTextEditor({ value, onChange, label, labels, id, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, horizontalRule: false })],
    content: value ?? { type: "doc", content: [] },
    // Rendered on the client only: the server has no DOM to measure.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: "pk-richtext min-h-48 px-3 py-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            heading2: current.isActive("heading", { level: 2 }),
            heading3: current.isActive("heading", { level: 3 }),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            quote: current.isActive("blockquote"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  });

  // The toolbar exists as soon as the editor does; `state` only says which tools are active,
  // and is null until the first transaction.
  const flags = state ?? {
    bold: false,
    italic: false,
    heading2: false,
    heading3: false,
    bulletList: false,
    orderedList: false,
    quote: false,
    canUndo: false,
    canRedo: false,
  };
  const tools: { key: keyof RichTextLabels; icon: IconName; active?: boolean; disabled?: boolean; run: () => void }[] =
    editor
      ? [
          { key: "bold", icon: "bold", active: flags.bold, run: () => editor.chain().focus().toggleBold().run() },
          {
            key: "italic",
            icon: "italic",
            active: flags.italic,
            run: () => editor.chain().focus().toggleItalic().run(),
          },
          {
            key: "heading2",
            icon: "heading-2",
            active: flags.heading2,
            run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          },
          {
            key: "heading3",
            icon: "heading-3",
            active: flags.heading3,
            run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          },
          {
            key: "bulletList",
            icon: "list-bullet",
            active: flags.bulletList,
            run: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            key: "orderedList",
            icon: "list-ordered",
            active: flags.orderedList,
            run: () => editor.chain().focus().toggleOrderedList().run(),
          },
          {
            key: "quote",
            icon: "quote",
            active: flags.quote,
            run: () => editor.chain().focus().toggleBlockquote().run(),
          },
          { key: "undo", icon: "undo", disabled: !flags.canUndo, run: () => editor.chain().focus().undo().run() },
          { key: "redo", icon: "redo", disabled: !flags.canRedo, run: () => editor.chain().focus().redo().run() },
        ]
      : [];

  return (
    <div
      className={cn(
        "border-border bg-surface focus-within:ring-focus-ring rounded-md border focus-within:ring-2",
        className,
      )}
    >
      <div role="toolbar" aria-label={labels.toolbar} className="border-border flex flex-wrap gap-1 border-b p-1">
        {tools.map((tool) => (
          <IconButton
            key={tool.key}
            name={tool.icon}
            size="sm"
            variant={tool.active ? "secondary" : "ghost"}
            label={labels[tool.key]}
            aria-pressed={tool.active === undefined ? undefined : tool.active}
            disabled={tool.disabled}
            onClick={tool.run}
          />
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
