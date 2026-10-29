import { pushToDataLayer } from "./datalayer";

/**
 * What people do on `/studio/upload` (upload redesign Phase 1 item 6, Phase 2 item 8) — the catalogue wrapper's channel
 * (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor accepted analytics. Never a file name, a file's content or
 * anything typed: sources, sizes in MB, counts, product slugs and size codes only.
 */
export interface UploadEvents {
  /** Files were chosen. `source`: how they came (`drop` = dropped on the card, `picker` = the file dialog). */
  upload_start: { source: "drop" | "picker" | "drive" | "dropbox" | "onedrive" | "link" | "email"; files: number };
  /** A file reached storage. */
  upload_done: { size_mb: number };
  /** A file was refused or failed: `type`, `size`, `network`, `scan`, `check`. */
  upload_fail: { reason: "type" | "size" | "network" | "scan" | "check" };
  /** A template was downloaded. */
  template_download: { product: string; size: string; format: "pdf" };
  /** "สั่งซ้ำ" on a produced own-file order. */
  reorder_click: Record<string, never>;
  /** A version finished its check: counts of its levels (`auto` = system fixes offered, 0 until auto-fixes exist). */
  preflight_done: { errors: number; warnings: number; auto: number };
  /** An auto-fix applied (none offered yet; kept for when they are). */
  autofix_apply: { rule: string };
  /** The chosen product or size no longer matches the file's die lines. */
  detect_mismatch: { type: "product" | "size" };
  /** "ให้ทีมเตรียมพิมพ์แก้ให้" (not offered until its fee is set). */
  team_fix_add: Record<string, never>;
  /** "เปิดในสตูดิโอ" (not offered until conversion exists). */
  open_in_studio: Record<string, never>;
  /** Checked files went in the cart. */
  add_to_cart_with_file: { versions: number };
}

export type UploadEventName = keyof UploadEvents;

export function trackUpload<K extends UploadEventName>(event: K, properties: UploadEvents[K]): void {
  pushToDataLayer(event, properties);
}
