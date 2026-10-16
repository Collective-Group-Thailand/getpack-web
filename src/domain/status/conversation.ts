import { defineStatusMap } from "./types";
import type { ConversationSlaState, ConversationStatus, RfqBasketStatus } from "./contract";

/** A conversation with getpack (D-300): open, waiting on the customer, or closed. */
export const CONVERSATION_STATUS = defineStatusMap<ConversationStatus>({
  open: { tone: "info", icon: "chat", labelKey: "conversation.open" },
  pending: { tone: "neutral", icon: "hourglass", labelKey: "conversation.pending" },
  closed: { tone: "neutral", icon: "check", labelKey: "conversation.closed" },
});

/** The first-response clock (D-221): waiting in time, overdue, answered. */
export const CONVERSATION_SLA = defineStatusMap<ConversationSlaState>({
  waiting: { tone: "warning", icon: "clock", labelKey: "conversationSla.waiting" },
  overdue: { tone: "danger", icon: "timer", labelKey: "conversationSla.overdue" },
  answered: { tone: "success", icon: "check", labelKey: "conversationSla.answered" },
});

/** A multi-item RFQ basket (D-301): a draft, sent, or thrown away. */
export const RFQ_BASKET_STATUS = defineStatusMap<RfqBasketStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "rfqBasket.draft" },
  submitted: { tone: "info", icon: "send", labelKey: "rfqBasket.submitted" },
  discarded: { tone: "neutral", icon: "ban", labelKey: "rfqBasket.discarded" },
});
