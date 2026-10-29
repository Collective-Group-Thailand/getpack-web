/**
 * The upload page's file rules (upload redesign Phase 1 item 2): PDF or AI by name, within the size the API checks
 * automatically (`store.fileChecks.rules` `maxBytes`). The API decides again from the file's own bytes (D-457).
 */

export type Refusal = "type" | "size" | "empty";

const EXTENSIONS = [".pdf", ".ai"];

export function refusalOf(file: Pick<File, "name" | "size">, maxBytes: number | null): Refusal | null {
  const name = file.name.toLowerCase();
  if (!EXTENSIONS.some((ext) => name.endsWith(ext))) return "type";
  if (file.size === 0) return "empty";
  if (maxBytes !== null && file.size > maxBytes) return "size";
  return null;
}

/** The MIME type to presign with: the browser's, else from the extension (AI files often come with none). */
export function mimeOf(file: Pick<File, "name" | "type">): string {
  if (file.type) return file.type;
  return file.name.toLowerCase().endsWith(".ai") ? "application/illustrator" : "application/pdf";
}

/** Whole megabytes, for analytics (never the file itself). */
export const sizeMb = (bytes: number) => Math.max(1, Math.round(bytes / (1024 * 1024)));

/**
 * Files dropped somewhere else in the Studio (`/studio`'s "มีไฟล์แบบแล้ว", C7) handed to this page across a
 * client-side navigation — the file itself, not just its name (C9). Kept in memory only: a reload starts over.
 */
let pending: File[] = [];

export function handOffFiles(files: File[]): void {
  pending = files.slice(0, 20);
}

export function takeHandedFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
