import { defineStatusMap } from "./types";
import type {
  AgentApplicationStatus,
  AgentCommissionStatus,
  AgentDiscountRequestStatus,
  AgentFactoryLinkStatus,
  AgentForecastStatus,
  AgentLeadStage,
  AgentLeadStatus,
  AgentLinkStatus,
  AgentPayoutProfileStatus,
  AgentPlanVersionStatus,
  AgentQuoteStatus,
  AgentStatementStatus,
  AgentStatus,
  AgentTaxDeclarationStatus,
} from "./contract";

/** A sales agent — freelance or employee (D-416). Suspended agents keep their links but earn nothing new. */
export const AGENT_STATUS = defineStatusMap<AgentStatus>({
  active: { tone: "success", icon: "check", labelKey: "agent.active" },
  suspended: { tone: "warning", icon: "pause", labelKey: "agent.suspended" },
  ended: { tone: "neutral", icon: "archive", labelKey: "agent.ended" },
});

/** An application to become a freelance agent (D-416). */
export const AGENT_APPLICATION_STATUS = defineStatusMap<AgentApplicationStatus>({
  submitted: { tone: "info", icon: "hourglass", labelKey: "agentApplication.submitted" },
  approved: { tone: "success", icon: "check", labelKey: "agentApplication.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "agentApplication.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "agentApplication.withdrawn" },
});

/** A customer or company attributed to an agent for the plan's months (D-417). */
export const AGENT_LINK_STATUS = defineStatusMap<AgentLinkStatus>({
  active: { tone: "success", icon: "link", labelKey: "agentLink.active" },
  ended: { tone: "neutral", icon: "archive", labelKey: "agentLink.ended" },
});

/** A prospect an agent registered, protected for the lead window (D-417). */
export const AGENT_LEAD_STATUS = defineStatusMap<AgentLeadStatus>({
  registered: { tone: "info", icon: "shield", labelKey: "agentLead.registered" },
  converted: { tone: "success", icon: "check", labelKey: "agentLead.converted" },
  expired: { tone: "neutral", icon: "clock", labelKey: "agentLead.expired" },
  rejected: { tone: "neutral", icon: "ban", labelKey: "agentLead.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "agentLead.withdrawn" },
});

/** One commission line — order, factory bounty, adjustment or reversal (D-418, D-419). */
export const AGENT_COMMISSION_STATUS = defineStatusMap<AgentCommissionStatus>({
  pending: { tone: "info", icon: "hourglass", labelKey: "agentCommission.pending" },
  held: { tone: "warning", icon: "shield-alert", labelKey: "agentCommission.held" },
  earned: { tone: "success", icon: "coins", labelKey: "agentCommission.earned" },
  statemented: { tone: "info", icon: "document", labelKey: "agentCommission.statemented" },
  paid: { tone: "success", icon: "wallet", labelKey: "agentCommission.paid" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "agentCommission.cancelled" },
});

/** A monthly agent statement (D-420). */
export const AGENT_STATEMENT_STATUS = defineStatusMap<AgentStatementStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "agentStatement.draft" },
  approved: { tone: "info", icon: "stamp", labelKey: "agentStatement.approved" },
  exported: { tone: "info", icon: "spreadsheet", labelKey: "agentStatement.exported" },
  paid: { tone: "success", icon: "wallet", labelKey: "agentStatement.paid" },
  voided: { tone: "neutral", icon: "ban", labelKey: "agentStatement.voided" },
});

/** A version of a commission plan, approved by someone other than its author (D-418). */
export const AGENT_PLAN_VERSION_STATUS = defineStatusMap<AgentPlanVersionStatus>({
  draft: { tone: "warning", icon: "edit", labelKey: "agentPlanVersion.draft" },
  approved: { tone: "success", icon: "stamp", labelKey: "agentPlanVersion.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "agentPlanVersion.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "agentPlanVersion.withdrawn" },
});

/** A factory an agent brought in, earning a bounty once it completes its qualifying jobs (D-419). */
export const AGENT_FACTORY_LINK_STATUS = defineStatusMap<AgentFactoryLinkStatus>({
  pending: { tone: "info", icon: "hourglass", labelKey: "agentFactoryLink.pending" },
  qualified: { tone: "success", icon: "check", labelKey: "agentFactoryLink.qualified" },
  expired: { tone: "neutral", icon: "clock", labelKey: "agentFactoryLink.expired" },
  ended: { tone: "neutral", icon: "archive", labelKey: "agentFactoryLink.ended" },
});

/** An agent's ล.ย.01 allowance declaration, checked by Finance (D-465). */
/** D-466: an agent's payout profile — drafted by the agent, checked by Finance. */
export const AGENT_PAYOUT_PROFILE_STATUS = defineStatusMap<AgentPayoutProfileStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "agentPayoutProfile.draft" },
  submitted: { tone: "warning", icon: "clock", labelKey: "agentPayoutProfile.submitted" },
  verified: { tone: "success", icon: "check", labelKey: "agentPayoutProfile.verified" },
  rejected: { tone: "danger", icon: "ban", labelKey: "agentPayoutProfile.rejected" },
});

export const AGENT_TAX_DECLARATION_STATUS = defineStatusMap<AgentTaxDeclarationStatus>({
  submitted: { tone: "warning", icon: "clock", labelKey: "agentTaxDeclaration.submitted" },
  accepted: { tone: "success", icon: "check", labelKey: "agentTaxDeclaration.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "agentTaxDeclaration.rejected" },
});

/**
 * A lead's stage in the agent's pipeline (D-468): new → contacted → quoted → negotiating → won / lost. `won` is the
 * system's (first payment); every other move is the agent's, through a menu — never by dragging only (WCAG 2.5.7).
 */
export const AGENT_LEAD_STAGE = defineStatusMap<AgentLeadStage>({
  new: { tone: "neutral", icon: "sparkles", labelKey: "agentLeadStage.new" },
  contacted: { tone: "info", icon: "phone", labelKey: "agentLeadStage.contacted" },
  quoted: { tone: "primary", icon: "document", labelKey: "agentLeadStage.quoted" },
  negotiating: { tone: "warning", icon: "handshake", labelKey: "agentLeadStage.negotiating" },
  won: { tone: "success", icon: "star", labelKey: "agentLeadStage.won" },
  lost: { tone: "neutral", icon: "ban", labelKey: "agentLeadStage.lost" },
});

/** A quote an agent sent for a lead (D-468): sent, opened by the customer, accepted (ordered), expired, withdrawn. */
export const AGENT_QUOTE_STATUS = defineStatusMap<AgentQuoteStatus>({
  sent: { tone: "info", icon: "send", labelKey: "agentQuote.sent" },
  opened: { tone: "primary", icon: "eye", labelKey: "agentQuote.opened" },
  accepted: { tone: "success", icon: "check", labelKey: "agentQuote.accepted" },
  expired: { tone: "neutral", icon: "clock", labelKey: "agentQuote.expired" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "agentQuote.withdrawn" },
});

/** A discount request round (D-468 §3): waiting for getpack, options offered, one accepted, refused or closed. */
export const AGENT_DISCOUNT_REQUEST_STATUS = defineStatusMap<AgentDiscountRequestStatus>({
  open: { tone: "info", icon: "hourglass", labelKey: "agentDiscountRequest.open" },
  offered: { tone: "warning", icon: "tag", labelKey: "agentDiscountRequest.offered" },
  accepted: { tone: "success", icon: "check", labelKey: "agentDiscountRequest.accepted" },
  rejected: { tone: "neutral", icon: "ban", labelKey: "agentDiscountRequest.rejected" },
  closed: { tone: "neutral", icon: "archive", labelKey: "agentDiscountRequest.closed" },
});

/** One order in the commission forecast (F47, D-468 §7). */
export const AGENT_FORECAST_STATUS = defineStatusMap<AgentForecastStatus>({
  in_progress: { tone: "neutral", icon: "package", labelKey: "agentForecast.in_progress" },
  pending: { tone: "info", icon: "hourglass", labelKey: "agentForecast.pending" },
  held: { tone: "warning", icon: "shield-alert", labelKey: "agentForecast.held" },
  earned: { tone: "success", icon: "coins", labelKey: "agentForecast.earned" },
  statemented: { tone: "info", icon: "document", labelKey: "agentForecast.statemented" },
  paid: { tone: "success", icon: "wallet", labelKey: "agentForecast.paid" },
});
