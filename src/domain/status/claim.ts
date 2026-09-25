import { defineStatusMap } from "./types";
import type { ClaimStatus } from "./contract";

/** A claim within 7 days of receipt; liability per D-083 (D-082). */
export const CLAIM_STATUS = defineStatusMap<ClaimStatus>({
  submitted: { tone: "info", icon: "flag", labelKey: "claim.submitted" },
  under_review: { tone: "primary", icon: "eye", labelKey: "claim.underReview" },
  need_info: { tone: "warning", icon: "help", labelKey: "claim.needInfo" },
  factory_review: { tone: "info", icon: "factory", labelKey: "claim.factoryReview" },
  approved: { tone: "success", icon: "check", labelKey: "claim.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "claim.rejected" },
  resolved: { tone: "success", icon: "package-check", labelKey: "claim.resolved" },
  closed: { tone: "neutral", icon: "archive", labelKey: "claim.closed" },
});
