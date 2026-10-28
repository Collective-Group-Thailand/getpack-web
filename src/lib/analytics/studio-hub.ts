import { pushToDataLayer } from "./datalayer";

/**
 * What people do on the Studio's front door (`/studio`, studio redesign Phase 1 item 9) — through the catalogue
 * wrapper's channel (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor accepted analytics (`pk_consent`).
 * Nothing identifies a person: never the brand name typed or the logo file, only which control and which style.
 */
export interface StudioHubEvents {
  /** A control of the hero's mini editor was used. */
  studio_hero_interact: { field: "logo" | "brand" | "size" | "colour" };
  /** "เปิดในสตูดิโอ" from the mini editor. */
  studio_hero_open_editor: Record<string, never>;
  /** An entry path was chosen. */
  studio_path: { path: "box" | "product" | "file" | "reorder" };
  /** The inline finder was asked (the unit and use chosen, never the measurements). */
  studio_finder_submit: { unit: "mm" | "cm" | "in"; use: "parcel" | "pallet" | "shelf" };
  /** "ออกแบบแบบนี้" on a finder result (`rank` from 1). */
  studio_finder_pick: { style: string; rank: number };
  /** "เปิดในสตูดิโอ" on a featured style. */
  studio_template_open: { style: string };
  /** "ลองกับแบบตัวอย่าง". */
  studio_try_sample: Record<string, never>;
  /** A saved design opened from "แบบล่าสุดของคุณ". */
  studio_draft_open: Record<string, never>;
}

export type StudioHubEventName = keyof StudioHubEvents;

export function trackStudioHub<K extends StudioHubEventName>(event: K, properties: StudioHubEvents[K]): void {
  pushToDataLayer(event, properties);
}
