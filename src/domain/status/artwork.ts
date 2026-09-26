import { defineStatusMap } from "./types";
import type { ArtworkStatus } from "./contract";

/** The artwork of one order item. Production waits on this and on payment independently (D-073). */
export const ARTWORK_STATUS = defineStatusMap<ArtworkStatus>({
  awaiting_template: { tone: "neutral", icon: "hourglass", labelKey: "artwork.awaitingTemplate" },
  awaiting_upload: { tone: "warning", icon: "upload", labelKey: "artwork.awaitingUpload" },
  uploaded: { tone: "info", icon: "file-check", labelKey: "artwork.uploaded" },
  in_review: { tone: "info", icon: "eye", labelKey: "artwork.inReview" },
  proof_sent: { tone: "primary", icon: "send", labelKey: "artwork.proofSent" },
  changes_requested: { tone: "warning", icon: "edit", labelKey: "artwork.changesRequested" },
  approved: { tone: "success", icon: "check", labelKey: "artwork.approved" },
});
