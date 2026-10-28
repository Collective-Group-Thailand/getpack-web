import { pushToDataLayer } from "./datalayer";

/** The Studio editor's two modes (D-456). */
export type EditorModeName = "easy" | "pro";

/**
 * What people do in the Studio editor (`/studio/[id]`, editor redesign Phase 1 item 6) — through the catalogue
 * wrapper's channel (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor accepted analytics (`pk_consent`).
 * Nothing identifies a person or their artwork: only modes, tool and rule ids, counts.
 */
export interface EditorEvents {
  /** The editor opened with a box, in this mode. */
  editor_open: { mode: EditorModeName };
  /** The mode switch was used. */
  editor_mode_switch: { from: EditorModeName; to: EditorModeName };
  /** A card of the first-open chooser was picked. */
  editor_welcome_pick: { choice: "easy" | "pro" | "design_service" | "file" };
  /** A tool of the pro toolbox (or its key) was chosen. */
  editor_tool: { tool: string };
  /** A preflight finding was opened (from the canvas marker or the list). */
  editor_issue_view: { rule: string };
  /** "แก้ให้" (count 1) or "แก้ทั้งหมด" (count = fixes applied) for a rule. */
  editor_autofix: { rule: string; count: number };
  /** "สั่งผลิต" in the top bar, with the blocking findings left. */
  editor_order_click: { errors: number };
}

export type EditorEventName = keyof EditorEvents;

export function trackEditor<K extends EditorEventName>(event: K, properties: EditorEvents[K]): void {
  pushToDataLayer(event, properties);
}
