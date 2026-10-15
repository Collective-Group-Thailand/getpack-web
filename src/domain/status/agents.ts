import { defineStatusMap } from "./types";
import type {
  AgentApplicationStatus,
  AgentCommissionStatus,
  AgentFactoryLinkStatus,
  AgentLeadStatus,
  AgentLinkStatus,
  AgentPlanVersionStatus,
  AgentStatementStatus,
  AgentStatus,
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
