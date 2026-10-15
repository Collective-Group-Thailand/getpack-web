/** The sales agent desk's lists and types (D-416 – D-423), in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Agent = Schemas["AdminAgentDto"];
export type AgentApplication = Schemas["AdminAgentApplicationDto"];
export type AgentLink = Schemas["AdminAgentLinkDto"];
export type AgentLead = Schemas["AdminAgentLeadDto"];
export type AgentFactoryLink = Schemas["AgentFactoryLinkDto"];
export type AgentCommission = Schemas["AdminAgentCommissionDto"];
export type AgentStatement = Schemas["AdminAgentStatementDto"];
export type AgentStatementDetail = Schemas["AdminAgentStatementDetailDto"];
export type AgentPlan = Schemas["AgentPlanDto"];
export type AgentPlanVersion = Schemas["AgentPlanVersionDto"];
export type AgentPlanTerms = Schemas["AgentPlanTermsDto"];
export type AgentKind = Schemas["AgentKind"];

export const AGENT_KINDS = ["freelance", "employee"] as const satisfies readonly AgentKind[];
export const AGENT_STATUSES = ["active", "suspended", "ended"] as const satisfies readonly Schemas["AgentStatus"][];
export const APPLICATION_STATUSES = [
  "submitted",
  "approved",
  "rejected",
  "withdrawn",
] as const satisfies readonly Schemas["AgentApplicationStatus"][];
export const LINK_STATUSES = ["active", "ended"] as const satisfies readonly Schemas["AgentLinkStatus"][];
export const LEAD_STATUSES = [
  "registered",
  "converted",
  "expired",
  "rejected",
  "withdrawn",
] as const satisfies readonly Schemas["AgentLeadStatus"][];
export const LEAD_KINDS = ["customer", "factory"] as const satisfies readonly Schemas["AgentLeadKind"][];
export const COMMISSION_STATUSES = [
  "pending",
  "held",
  "earned",
  "statemented",
  "paid",
  "cancelled",
] as const satisfies readonly Schemas["AgentCommissionStatus"][];
export const COMMISSION_KINDS = [
  "order",
  "factory_bounty",
  "adjustment",
  "reversal",
] as const satisfies readonly Schemas["AgentCommissionKind"][];
export const STATEMENT_STATUSES = [
  "draft",
  "approved",
  "exported",
  "paid",
  "voided",
] as const satisfies readonly Schemas["AgentStatementStatus"][];
export const FACTORY_LINK_STATUSES = [
  "pending",
  "qualified",
  "expired",
  "ended",
] as const satisfies readonly Schemas["AgentFactoryLinkStatus"][];

export const agentsList = defineList<Agent>({
  key: "agent",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agents", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.legalName,
  defaults: { filterKeys: ["status", "kind"] },
});

export const applicationsList = defineList<AgentApplication>({
  key: "agent_application",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agent-applications", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.legalName,
  defaults: { filterKeys: ["status"] },
  staleTime: STALE_TIME.live,
});

export const linksList = defineList<AgentLink>({
  key: "agent_link",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agent-links", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.name,
  defaults: { filterKeys: ["status", "agentId", "customerId", "companyId"] },
});

export const leadsList = defineList<AgentLead>({
  key: "agent_lead",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agent-leads", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.contactName,
  defaults: { filterKeys: ["status", "kind", "agentId"] },
});

export const factoryLinksList = defineList<AgentFactoryLink>({
  key: "agent_factory_link",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agent-factory-links", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.factoryName,
  defaults: { filterKeys: ["status", "agentId"] },
});

export const commissionsList = defineList<AgentCommission>({
  key: "agent_commission",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agent-commissions", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.orderCode ?? row.factoryName ?? row.id.slice(0, 8),
  defaults: { filterKeys: ["status", "kind", "agentId"] },
  staleTime: STALE_TIME.live,
});

export const statementsList = defineList<AgentStatement>({
  key: "agent_statement",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/agent-statements", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.statementNo,
  defaults: { filterKeys: ["status", "period", "kind", "agentId"] },
});
