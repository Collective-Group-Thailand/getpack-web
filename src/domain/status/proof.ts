import { defineStatusMap } from "./types";
import type { ProofStatus } from "./contract";

/** A proof sent for customer approval (proposed — see `./contract.ts`). */
export const PROOF_STATUS = defineStatusMap<ProofStatus>({
  preparing: { tone: "neutral", icon: "edit", labelKey: "proof.preparing" },
  sent: { tone: "info", icon: "send", labelKey: "proof.sent" },
  in_review: { tone: "info", icon: "eye", labelKey: "proof.inReview" },
  changes_requested: { tone: "warning", icon: "edit", labelKey: "proof.changesRequested" },
  approved: { tone: "success", icon: "file-check", labelKey: "proof.approved" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "proof.expired" },
});
