/**
 * The published design keeps the designer's document opaque (`DesignDocumentDto.document`); this
 * reads the `{ spec, content }` pair back out of it, on the server or in the browser.
 */
export function documentOf(design: { document?: unknown }): { spec: unknown; content: unknown } | null {
  const document = design.document as { spec?: unknown; content?: unknown } | null | undefined;
  return document && document.spec && document.content ? { spec: document.spec, content: document.content } : null;
}
