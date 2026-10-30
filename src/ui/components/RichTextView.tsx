import { Fragment } from "react";

import { cn } from "../lib/cn";

/**
 * A ProseMirror / TipTap JSON node, as the API stores an article body (`StoreArticleDto.body`).
 * Typed loosely on purpose: the document is content, and a node this renderer does not know is
 * rendered by its text rather than failing the page.
 */
export interface RichTextNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: RichTextNode[];
}

type LinkLike = React.ComponentType<{ href: string; className?: string; children?: React.ReactNode }>;

export interface RichTextViewProps {
  /** The `doc` node. Anything else renders nothing. */
  doc: unknown;
  /** The zone's locale-aware link, for links inside the site (`/products/...`). */
  linkAs?: LinkLike;
  className?: string;
  /** Gives each `h2`/`h3` the id `richTextHeadings` lists, so a table of contents can link to it. */
  anchorHeadings?: boolean;
}

/** One section heading of a rich-text body: the id `RichTextView anchorHeadings` gives it, its words and level. */
export interface RichTextHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

const plainText = (node: RichTextNode): string =>
  node.type === "text" ? (node.text ?? "") : (node.content ?? []).filter(isNode).map(plainText).join("");

function headingNodes(doc: unknown): Map<RichTextNode, RichTextHeading> {
  const found = new Map<RichTextNode, RichTextHeading>();
  const walk = (node: RichTextNode) => {
    if (node.type === "heading") {
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level ?? 2)));
      const text = plainText(node).trim();
      if (level <= 3 && text) found.set(node, { id: `section-${found.size + 1}`, text, level: level as 2 | 3 });
      return;
    }
    (node.content ?? []).filter(isNode).forEach(walk);
  };
  if (isNode(doc)) walk(doc);
  return found;
}

/** The `h2`/`h3` headings of a body, in order — for a table of contents beside the article. */
export function richTextHeadings(doc: unknown): RichTextHeading[] {
  return [...headingNodes(doc).values()];
}

/** Only these reach an `href`: a `javascript:` link in stored content must not become a link. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return /^(https?:|mailto:|tel:)/i.test(href) ? href : null;
}

function isNode(value: unknown): value is RichTextNode {
  return typeof value === "object" && value !== null;
}

function renderText(node: RichTextNode, key: number, linkAs?: LinkLike): React.ReactNode {
  let out: React.ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "code":
        out = <code className="bg-bg-subtle rounded px-1 text-[0.9em] tabular-nums">{out}</code>;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (!href) break;
        const className = "text-primary underline underline-offset-2 hover:no-underline";
        const Internal = href.startsWith("/") ? linkAs : undefined;
        out = Internal ? (
          <Internal href={href} className={className}>
            {out}
          </Internal>
        ) : (
          <a href={href} className={className} rel="noopener noreferrer">
            {out}
          </a>
        );
        break;
      }
    }
  }
  return <Fragment key={key}>{out}</Fragment>;
}

type Anchors = Map<RichTextNode, RichTextHeading> | undefined;

function renderNodes(nodes: unknown, linkAs?: LinkLike, anchors?: Anchors): React.ReactNode {
  if (!Array.isArray(nodes)) return null;
  return nodes.filter(isNode).map((node, index) => renderNode(node, index, linkAs, anchors));
}

function renderNode(node: RichTextNode, key: number, linkAs?: LinkLike, anchors?: Anchors): React.ReactNode {
  const children = renderNodes(node.content, linkAs, anchors);
  switch (node.type) {
    case "text":
      return renderText(node, key, linkAs);
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      // The page owns its one `h1` (design-system.md §6); content headings start at `h2`.
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level ?? 2)));
      const Heading = `h${level}` as "h2" | "h3" | "h4";
      return (
        <Heading key={key} id={anchors?.get(node)?.id}>
          {children}
        </Heading>
      );
    }
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      const src = safeHref(node.attrs?.src);
      if (!src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- content image from the API
        <img
          key={key}
          src={src}
          alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""}
          loading="lazy"
          decoding="async"
        />
      );
    }
    default:
      // Unknown block: keep its words rather than lose them.
      return <Fragment key={key}>{children}</Fragment>;
  }
}

/**
 * Renders stored rich text (an article body) as plain HTML elements — on the server, without
 * TipTap. The editor is a back-office bundle (`RichTextEditor`); a reader needs none of it, and
 * the storefront's budget cannot carry it.
 *
 * Nothing is injected as HTML: every node becomes a React element, so stored content cannot
 * smuggle markup or script, and links are limited to `http(s)`, `mailto`, `tel` and paths.
 */
export function RichTextView({ doc, linkAs, className, anchorHeadings = false }: RichTextViewProps) {
  if (!isNode(doc) || doc.type !== "doc") return null;
  return (
    <div
      className={cn(
        "[&_blockquote]:border-border [&_blockquote]:text-muted [&_hr]:border-border [&_pre]:bg-bg-subtle max-w-prose leading-relaxed [&_blockquote]:border-s-4 [&_blockquote]:ps-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_hr]:my-8 [&_img]:my-6 [&_img]:rounded-lg [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4 [&_ul]:list-disc [&_ul]:ps-6 [&>*:first-child]:mt-0",
        className,
      )}
    >
      {renderNodes(doc.content, linkAs, anchorHeadings ? headingNodes(doc) : undefined)}
    </div>
  );
}
