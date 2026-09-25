import { defineStatusMap } from "./types";
import type { ConsultationStatus, RfqQuoteStatus, RfqStatus } from "./contract";

/** A request for quote, with an SLA per category (D-100, D-043). */
export const RFQ_STATUS = defineStatusMap<RfqStatus>({
  submitted: { tone: "info", icon: "inbox", labelKey: "rfq.submitted" },
  in_review: { tone: "primary", icon: "eye", labelKey: "rfq.inReview" },
  need_info: { tone: "warning", icon: "help", labelKey: "rfq.needInfo" },
  quoted: { tone: "primary", icon: "receipt", labelKey: "rfq.quoted" },
  accepted: { tone: "success", icon: "check", labelKey: "rfq.accepted" },
  declined: { tone: "neutral", icon: "ban", labelKey: "rfq.declined" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "rfq.expired" },
});

/** A quote composed for an RFQ (B2.5). */
export const RFQ_QUOTE_STATUS = defineStatusMap<RfqQuoteStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "rfqQuote.draft" },
  sent: { tone: "primary", icon: "send", labelKey: "rfqQuote.sent" },
  accepted: { tone: "success", icon: "check", labelKey: "rfqQuote.accepted" },
  superseded: { tone: "neutral", icon: "history", labelKey: "rfqQuote.superseded" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "rfqQuote.expired" },
});

/** A request to a factory for its price on an RFQ (B2.5). */
export const CONSULTATION_STATUS = defineStatusMap<ConsultationStatus>({
  requested: { tone: "info", icon: "send", labelKey: "consultation.requested" },
  responded: { tone: "success", icon: "check", labelKey: "consultation.responded" },
  declined: { tone: "neutral", icon: "ban", labelKey: "consultation.declined" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "consultation.expired" },
});
