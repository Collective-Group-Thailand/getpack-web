/** The company sales desk's lists and types (D-469, D-470), in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type SalesInbound = Schemas["SalesInboundDto"];
export type SalesLead = Schemas["AdminAgentLeadDto"];
export type SalesQuote = Schemas["AgentQuoteDto"];
export type SalesRep = Schemas["SalesRepDto"];
export type ApprovalSummary = Schemas["DiscountApprovalSummaryDto"];
export type Approval = Schemas["DiscountApprovalDto"];
export type Waterfall = Approval["waterfall"];
export type FullWaterfall = Schemas["FullWaterfallDto"];
export type MarginWaterfall = Schemas["MarginPctWaterfallDto"];
export type WaterfallView = Schemas["WaterfallViewDto"];
export type PlaybookCardAdmin = Schemas["PlaybookCardAdminDto"];
export type SalesDashboard = Schemas["SalesDashboardDto"];
export type DiscountRound = Schemas["AgentDiscountRequestDto"];

export const INBOUND_STATUSES = [
  "new",
  "assigned",
  "contacted",
  "converted_to_lead",
  "disqualified",
] as const satisfies readonly Schemas["SalesInboundStatus"][];
export const INBOUND_SOURCES = [
  "contact_form",
  "rfq",
  "studio_idle",
  "dieline_download",
  "line_chat",
  "manual",
] as const satisfies readonly Schemas["SalesInboundSource"][];
export const DISQUALIFY_REASONS = [
  "not_a_buyer",
  "duplicate",
  "no_response",
  "out_of_scope",
  "spam",
  "other",
] as const satisfies readonly Schemas["SalesInboundDisqualifyReason"][];
export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "countered",
  "rejected",
  "stale",
  "withdrawn",
] as const satisfies readonly Schemas["SalesDiscountApprovalStatus"][];
export const APPROVAL_LEVELS = [
  "rep",
  "sales_manager",
  "c_level",
] as const satisfies readonly Schemas["SalesDiscountApprovalLevel"][];
export const PLAYBOOK_STATUSES = [
  "draft",
  "published",
  "retired",
] as const satisfies readonly Schemas["TemplateVersionStatus"][];
export const PLAYBOOK_CONTEXTS = [
  "all",
  "first_contact",
  "follow_up",
  "discount_request",
  "competitor_cheaper",
  "big_deal",
  "lead_lost_price",
] as const satisfies readonly Schemas["SalesPlaybookContext"][];
export const PLAYBOOK_AUDIENCES = [
  "agent",
  "rep",
  "manager",
] as const satisfies readonly Schemas["SalesPlaybookAudience"][];
export const QUANTITY_BANDS = [
  "lt_1k",
  "1k_10k",
  "10k_100k",
  "gte_100k",
] as const satisfies readonly Schemas["SalesQuantityBand"][];

/** D-469: the inbound pool, soonest first response due first. A rep reads only what is assigned to them (the API scopes). */
export const inboundList = defineList<SalesInbound>({
  key: "sales_inbound_lead",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/sales/inbound", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.contactName,
  defaults: { filterKeys: ["status", "source", "assigneeId", "unassigned", "breached", "minScore"] },
  staleTime: STALE_TIME.live,
});

/** D-469: sales quotes (agent quotes made from the desk's leads). */
export const salesQuotesList = defineList<SalesQuote>({
  key: "sales_quote",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/sales/quotes", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.quote.quoteCode ?? row.lead.contactName,
  defaults: { filterKeys: ["status", "leadId", "agentId"] },
});

/** D-470: the discount approval desk, pending first by due time. */
export const approvalsList = defineList<ApprovalSummary>({
  key: "sales_discount_approval",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/sales/discount-approvals", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.quote.quoteCode ?? row.lead.contactName,
  defaults: { filterKeys: ["status", "level", "awaitingMe"] },
  staleTime: STALE_TIME.live,
});

/** D-470: who saw which waterfall, in which tier (`sales_waterfall_views.read`). */
export const waterfallViewsList = defineList<WaterfallView>({
  key: "sales_waterfall_view",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/sales/discount-approvals/views", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.quoteCode ?? row.quoteId.slice(0, 8),
  defaults: { filterKeys: ["quoteId", "viewerId"] },
});

/** D-470: every version of every playbook card. */
export const playbookList = defineList<PlaybookCardAdmin>({
  key: "sales_playbook_card",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/sales/playbook", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => `${row.key} v${row.version}`,
  defaults: { filterKeys: ["status", "key", "audience"], perPage: 50 },
});
