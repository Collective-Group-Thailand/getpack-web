import { defineStatusMap } from "./types";
import type {
  PlaybookCardStatus,
  SalesAuthorityColour,
  SalesDiscountApprovalStatus,
  SalesFactoryPriceLockStatus,
  SalesFloorCheck,
  SalesInboundSource,
  SalesInboundStatus,
  SalesNegotiationOutcome,
} from "./contract";
import type { StatusTone } from "./types";

/** A sales enquiry in the inbound pool (D-469): new → assigned → contacted → converted to a lead, or disqualified. */
export const SALES_INBOUND_STATUS = defineStatusMap<SalesInboundStatus>({
  new: { tone: "warning", icon: "inbox", labelKey: "salesInbound.new" },
  assigned: { tone: "info", icon: "user", labelKey: "salesInbound.assigned" },
  contacted: { tone: "primary", icon: "phone", labelKey: "salesInbound.contacted" },
  converted_to_lead: { tone: "success", icon: "user-plus", labelKey: "salesInbound.converted_to_lead" },
  disqualified: { tone: "neutral", icon: "ban", labelKey: "salesInbound.disqualified" },
});

/** A discount approval (D-470): pending → approved / rejected / countered; stale when the quote changed; withdrawn. */
export const SALES_DISCOUNT_APPROVAL_STATUS = defineStatusMap<SalesDiscountApprovalStatus>({
  pending: { tone: "warning", icon: "hourglass", labelKey: "salesApproval.pending" },
  approved: { tone: "success", icon: "check", labelKey: "salesApproval.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "salesApproval.rejected" },
  countered: { tone: "info", icon: "undo", labelKey: "salesApproval.countered" },
  stale: { tone: "neutral", icon: "clock", labelKey: "salesApproval.stale" },
  withdrawn: { tone: "neutral", icon: "archive", labelKey: "salesApproval.withdrawn" },
});

/**
 * The authority colour of a discount (D-470): green = within the rep's authority, amber = a sales manager's, red =
 * C-Level's (below the floor or above the manager's limit). Words and an icon carry it; the colour only reinforces.
 */
export const SALES_AUTHORITY_LEVEL = defineStatusMap<SalesAuthorityColour>({
  green: { tone: "success", icon: "check", labelKey: "salesAuthority.green" },
  amber: { tone: "warning", icon: "shield-alert", labelKey: "salesAuthority.amber" },
  red: { tone: "danger", icon: "flag", labelKey: "salesAuthority.red" },
});

/** The margin floor check (D-012, D-470): at or above the walk-away floor, or below it. */
export const SALES_FLOOR_CHECK = defineStatusMap<SalesFloorCheck>({
  pass: { tone: "success", icon: "check", labelKey: "salesFloor.pass" },
  fail: { tone: "danger", icon: "flag", labelKey: "salesFloor.fail" },
});

/** A sales playbook card version (D-470): draft (maybe submitted), published, retired. */
export const SALES_PLAYBOOK_STATUS = defineStatusMap<PlaybookCardStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "salesPlaybook.draft" },
  published: { tone: "success", icon: "check", labelKey: "salesPlaybook.published" },
  retired: { tone: "neutral", icon: "archive", labelKey: "salesPlaybook.retired" },
});

/** How a negotiated quote ended (D-470 negotiation history). */
export const SALES_NEGOTIATION_OUTCOME = defineStatusMap<SalesNegotiationOutcome>({
  open: { tone: "info", icon: "hourglass", labelKey: "salesOutcome.open" },
  won: { tone: "success", icon: "star", labelKey: "salesOutcome.won" },
  lost: { tone: "neutral", icon: "ban", labelKey: "salesOutcome.lost" },
});

/** A factory price lock recorded with a big-deal approval (D-470; partner confirmation deferred). */
export const SALES_PRICE_LOCK_STATUS = defineStatusMap<SalesFactoryPriceLockStatus>({
  requested: { tone: "info", icon: "hourglass", labelKey: "salesPriceLock.requested" },
  confirmed: { tone: "success", icon: "lock", labelKey: "salesPriceLock.confirmed" },
  expired: { tone: "neutral", icon: "clock", labelKey: "salesPriceLock.expired" },
  released: { tone: "neutral", icon: "undo", labelKey: "salesPriceLock.released" },
});

/**
 * Where an inbound sales item came from (D-469, D-471): what the person did, so a rep knows how warm the contact is
 * before reading the need. The icon carries it in the list; the words say it to a screen reader and in the filter.
 */
export const SALES_INBOUND_SOURCE = defineStatusMap<SalesInboundSource>({
  contact_form: { tone: "info", icon: "mail", labelKey: "salesSource.contact_form" },
  rfq: { tone: "primary", icon: "calculator", labelKey: "salesSource.rfq" },
  line_chat: { tone: "success", icon: "line", labelKey: "salesSource.line_chat" },
  manual: { tone: "neutral", icon: "edit", labelKey: "salesSource.manual" },
  studio_idle: { tone: "warning", icon: "pen-tool", labelKey: "salesSource.studio_idle" },
  dieline_download: { tone: "neutral", icon: "download", labelKey: "salesSource.dieline_download" },
});

/**
 * The tone of a lead score chip (D-471). Presentation only — the score and its rules are the API's
 * (`sales.scoring_rules`); the chip shades the number by thirds of the 0–100 scale so a long list scans at a glance,
 * and never names a band ("hot", "cold"), which would be a business judgement the rules do not make.
 */
export function leadScoreTone(score: number): StatusTone {
  if (score >= 67) return "success";
  if (score >= 34) return "info";
  return "neutral";
}
