import { defineStatusMap } from "./types";
import type { ClaimStatus } from "./contract";

/** A customer claim (proposed — see `./contract.ts`; D-082 evidence, D-083 liability). */
export const CLAIM_STATUS = defineStatusMap<ClaimStatus>({
  submitted: { tone: "info", icon: "flag", labelKey: "claim.submitted" },
  in_review: { tone: "info", icon: "eye", labelKey: "claim.inReview" },
  awaiting_evidence: { tone: "warning", icon: "image", labelKey: "claim.awaitingEvidence" },
  approved: { tone: "success", icon: "check", labelKey: "claim.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "claim.rejected" },
  resolved: { tone: "success", icon: "success", labelKey: "claim.resolved" },
  withdrawn: { tone: "neutral", icon: "close", labelKey: "claim.withdrawn" },
});
