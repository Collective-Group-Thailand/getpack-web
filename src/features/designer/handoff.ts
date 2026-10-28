/**
 * C7 (studio Phase 1 item 2): what the Studio's front door hands the editor — the brand name typed or the logo
 * chosen in the hero's mini editor — so "เปิดในสตูดิโอ" opens the box with it already placed, without a second
 * upload. The logo never leaves the browser here (PDPA, brand confidentiality): it is held in this tab's memory
 * (the navigation to the editor is client-side) and in `sessionStorage` when it fits, and is consumed once. It
 * becomes an upload only when the customer's design is saved to the account, like any image in the editor.
 */
export interface StudioHandoff {
  brand: string | null;
  logo: { src: string; name: string } | null;
  /** The print chosen in the hero: the brand text is set in one ink or in full colour. */
  print: "none" | "one" | "full";
}

const KEY = "getpack.studio.handoff";
let pending: StudioHandoff | null = null;

export function giveHandoff(handoff: StudioHandoff): void {
  pending = handoff;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // A large logo may not fit the tab's storage: the in-memory copy still carries it on a client navigation.
  }
}

/** The hand-off once, then gone (a reload of the editor does not place it twice). */
export function takeHandoff(): StudioHandoff | null {
  let handoff = pending;
  pending = null;
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(KEY);
      window.sessionStorage.removeItem(KEY);
      if (!handoff && stored) handoff = JSON.parse(stored) as StudioHandoff;
    } catch {
      // Storage unavailable: the in-memory copy only.
    }
  }
  if (!handoff || (!handoff.brand?.trim() && !handoff.logo)) return null;
  return handoff;
}
