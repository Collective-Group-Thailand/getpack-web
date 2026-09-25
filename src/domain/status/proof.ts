import { defineStatusMap } from "./types";
import type { ProofStatus } from "./contract";

/** A proof version sent to the customer (B4.1). */
export const PROOF_STATUS = defineStatusMap<ProofStatus>({
  pending_customer: { tone: "warning", icon: "hourglass", labelKey: "proof.pendingCustomer" },
  approved: { tone: "success", icon: "check", labelKey: "proof.approved" },
  changes_requested: { tone: "warning", icon: "edit", labelKey: "proof.changesRequested" },
  superseded: { tone: "neutral", icon: "history", labelKey: "proof.superseded" },
});
