import { defineStatusMap } from "./types";
import type { AssistantTurnOutcome } from "./contract";

/** How an assistant turn ended (D-304): answered from tools, blocked for an unsupported fact, refused, handed to CS, failed. */
export const ASSISTANT_OUTCOME = defineStatusMap<AssistantTurnOutcome>({
  answered: { tone: "success", icon: "check", labelKey: "assistantOutcome.answered" },
  blocked_unsupported_fact: { tone: "warning", icon: "shield", labelKey: "assistantOutcome.blocked" },
  refused: { tone: "neutral", icon: "ban", labelKey: "assistantOutcome.refused" },
  handed_off: { tone: "info", icon: "chat", labelKey: "assistantOutcome.handedOff" },
  failed: { tone: "danger", icon: "error", labelKey: "assistantOutcome.failed" },
});
