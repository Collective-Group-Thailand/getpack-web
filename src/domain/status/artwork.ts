import { defineStatusMap } from "./types";
import type { ArtworkStatus } from "./contract";

/**
 * The artwork workflow (source: legacy `graphic_status` — see `./contract.ts`).
 *
 * This runs alongside the order status rather than inside it: production waits on artwork
 * approval *and* payment, independently (D-073).
 */
export const ARTWORK_STATUS = defineStatusMap<ArtworkStatus>({
  waiting_artwork: { tone: "warning", icon: "upload", labelKey: "artwork.waitingArtwork" },
  uploaded: { tone: "info", icon: "image", labelKey: "artwork.uploaded" },
  in_review: { tone: "info", icon: "eye", labelKey: "artwork.inReview" },
  // Not "rejected": the file is not wrong, it needs a change, and the difference is the whole
  // tone of the screen a customer lands on (voice-and-tone.md — never blame the user).
  changes_requested: { tone: "warning", icon: "edit", labelKey: "artwork.changesRequested" },
  approved: { tone: "success", icon: "check", labelKey: "artwork.approved" },
  production_confirmed: { tone: "success", icon: "success", labelKey: "artwork.productionConfirmed" },
});
