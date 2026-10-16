import { defineStatusMap } from "./types";
import type { ReorderSuggestionStatus, CallOffReleaseStatus, CallOffStatus } from "./contract";

/** A call-off agreement (U2.F5, D-290): asked → the factory accepts or declines → used until expiry. */
export const CALL_OFF_STATUS = defineStatusMap<CallOffStatus>({
  pending_factory: { tone: "neutral", icon: "hourglass", labelKey: "callOff.pendingFactory" },
  active: { tone: "success", icon: "check", labelKey: "callOff.active" },
  declined: { tone: "danger", icon: "ban", labelKey: "callOff.declined" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "callOff.cancelled" },
  expired: { tone: "neutral", icon: "clock", labelKey: "callOff.expired" },
});

/** One release of a call-off: a quotation at the locked price, then an order, or lapsed at expiry. */
export const CALL_OFF_RELEASE_STATUS = defineStatusMap<CallOffReleaseStatus>({
  quoted: { tone: "info", icon: "receipt", labelKey: "callOffRelease.quoted" },
  ordered: { tone: "success", icon: "package", labelKey: "callOffRelease.ordered" },
  lapsed: { tone: "neutral", icon: "clock", labelKey: "callOffRelease.lapsed" },
});

/** A reorder suggestion CS works (D-288): open until someone contacts the customer or sets it aside. */
export const REORDER_SUGGESTION_STATUS = defineStatusMap<ReorderSuggestionStatus>({
  open: { tone: "info", icon: "refresh", labelKey: "reorderSuggestion.open" },
  contacted: { tone: "success", icon: "phone", labelKey: "reorderSuggestion.contacted" },
  dismissed: { tone: "neutral", icon: "archive", labelKey: "reorderSuggestion.dismissed" },
});
