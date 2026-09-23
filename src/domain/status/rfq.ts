import { defineStatusMap } from "./types";
import type { RfqStatus } from "./contract";

/** A quote-on-request (proposed — see `./contract.ts`; D-100, D-043 tier C). */
export const RFQ_STATUS = defineStatusMap<RfqStatus>({
  submitted: { tone: "info", icon: "send", labelKey: "rfq.submitted" },
  in_review: { tone: "info", icon: "eye", labelKey: "rfq.inReview" },
  quoted: { tone: "primary", icon: "receipt", labelKey: "rfq.quoted" },
  accepted: { tone: "success", icon: "check", labelKey: "rfq.accepted" },
  // A declined RFQ is the raw material of the unmet-demand report (D-102), so it is a real
  // outcome rather than a dead end.
  declined: { tone: "neutral", icon: "ban", labelKey: "rfq.declined" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "rfq.expired" },
});
