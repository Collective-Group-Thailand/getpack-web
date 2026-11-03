import "server-only";

import { cache } from "react";

import { isApiError, serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

/**
 * getpack Agent's reads (D-467): the same `/v1/store/agent/*` endpoints the storefront's account pages used, now
 * through the agent zone's own session (`serverApi("agent")`, which refuses any path outside the zone's allow-list).
 */
export type AgentProgramme = Schemas["AgentProgrammeDto"];
export type Agent = Schemas["AgentDto"];
export type AgentLink = Schemas["AgentLinkDto"];
export type AgentLead = Schemas["AgentLeadDto"];
export type AgentCommission = Schemas["AgentCommissionDto"];
export type AgentStatement = Schemas["AgentStatementDto"];
export type AgentStatementDetail = Schemas["AgentStatementDetailDto"];
export type MyTaxDeclaration = Schemas["MyTaxDeclarationDto"];
export type MyPayoutProfile = Schemas["MyPayoutProfileDto"];
export type NotificationPreferences = Schemas["AgentNotificationPreferencesDto"];
export type MySession = Schemas["MySessionDto"];

export interface Page<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number };
}

const api = () => serverApi("agent");

/** The agreement, the plan and where the person stands (`store.agent.programme`, open to any customer). */
export const getProgramme = cache(async (): Promise<AgentProgramme> => {
  const { data } = await (await api()).GET("/v1/store/agent/programme");
  return data!;
});

/**
 * My agent profile with totals (`store.agent.me`), or `"ended"` when the agreement has ended (`agents.ended`: only
 * statements and 50 ทวิ remain), or `null` for someone who is not an agent (`agents.not_agent`).
 */
export const getAgentOrState = cache(async (): Promise<Agent | "ended" | null> => {
  try {
    const { data } = await (await api()).GET("/v1/store/agent");
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 403) {
      if (error.code === "agents.ended") return "ended";
      return null;
    }
    throw error;
  }
});

export async function getMyCustomers(page = 1): Promise<Page<AgentLink>> {
  const { data } = await (await api()).GET("/v1/store/agent/customers", { params: { query: { page, perPage: 25 } } });
  return data!;
}

export async function getMyLeads(page = 1): Promise<Page<AgentLead>> {
  const { data } = await (await api()).GET("/v1/store/agent/leads", { params: { query: { page, perPage: 25 } } });
  return data!;
}

export async function getMyCommissions(page = 1): Promise<Page<AgentCommission>> {
  const { data } = await (await api()).GET("/v1/store/agent/commissions", { params: { query: { page, perPage: 25 } } });
  return data!;
}

export async function getMyStatements(page = 1): Promise<Page<AgentStatement>> {
  const { data } = await (await api()).GET("/v1/store/agent/statements", { params: { query: { page, perPage: 25 } } });
  return data!;
}

export async function getMyStatement(statementId: string): Promise<AgentStatementDetail | null> {
  try {
    const { data } = await (
      await api()
    ).GET("/v1/store/agent/statements/{statementId}", { params: { path: { statementId } } });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** My ล.ย.01 of the current tax year (`store.agentTaxDeclaration.get`, D-465). */
export async function getMyTaxDeclaration(): Promise<MyTaxDeclaration> {
  const { data } = await (await api()).GET("/v1/store/agent/tax-declaration");
  return data!;
}

/** My payout profile (`store.agentPayoutProfile.get`, D-466) with the ETag a save needs. */
export const getMyPayoutProfile = cache(async (): Promise<{ data: MyPayoutProfile; etag: string | null }> => {
  const { data, response } = await (await api()).GET("/v1/store/agent/payout-profile");
  return { data: data!, etag: response.headers.get("ETag") };
});

/** Event × channel choices with what is locked and what can reach me (`store.agentNotificationPreferences.get`). */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await (await api()).GET("/v1/store/agent/notification-preferences");
  return data!;
}

/** My signed-in sessions on every surface (`store.me.sessions`, D-467). */
export async function getMySessions(): Promise<MySession[]> {
  const { data } = await (await api()).GET("/v1/store/me/sessions");
  return data?.data ?? [];
}

export type AgentApplication = Schemas["AgentApplicationDto"];

/** My latest application — what agreement version I accepted, and when (`store.agent.getApplication`). */
export async function getMyApplication(): Promise<AgentApplication | null> {
  try {
    const { data } = await (await api()).GET("/v1/store/agent/application");
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/* ------------------------------------------------------------------------------- Phase 3 (D-468) */

export type PipelineLead = Schemas["AgentLeadDto"];
export type LeadActivity = Schemas["AgentLeadActivityDto"];
export type AgentQuote = Schemas["AgentQuoteDto"];
export type DiscountRequest = Schemas["AgentDiscountRequestDto"];
export type PlaybookCard = Schemas["AgentPlaybookCardDto"];
export type PlaybookContext = Schemas["AgentPlaybookContext"];
export type CommissionForecast = Schemas["AgentCommissionForecastDto"];
export type LeadView = Schemas["AgentLeadView"];
export type LeadSort = Schemas["AgentLeadSort"];
export type LeadStage = Schemas["AgentLeadStage"];

export interface PipelineQuery {
  view?: LeadView;
  stage?: LeadStage;
  q?: string;
  sort?: LeadSort;
  order?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

/** The pipeline (`store.agentLeads.list`): one view, filters, a cursor. */
export async function getPipeline(query: PipelineQuery): Promise<{ data: PipelineLead[]; nextCursor: string | null }> {
  const { data } = await (await api()).GET("/v1/store/agent/leads/pipeline", {
    params: {
      query: {
        ...(query.view ? { view: query.view } : {}),
        ...(query.stage ? { stage: [query.stage] } : {}),
        ...(query.q ? { q: query.q } : {}),
        ...(query.sort ? { sort: query.sort } : {}),
        ...(query.order ? { order: query.order } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        limit: query.limit ?? 50,
      },
    },
  });
  return { data: data?.data ?? [], nextCursor: data?.meta.nextCursor ?? null };
}

/** One lead with the ETag an edit needs (`store.agentLeads.get`); `null` when it is not mine. */
export async function getLead(leadId: string): Promise<{ lead: PipelineLead; etag: string | null } | null> {
  try {
    const { data, response } = await (
      await api()
    ).GET("/v1/store/agent/leads/{leadId}", { params: { path: { leadId } } });
    return data ? { lead: data, etag: response.headers.get("ETag") } : null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) return null;
    throw error;
  }
}

/** The lead's timeline, newest first (`store.agentLeads.listActivities`). */
export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const { data } = await (
    await api()
  ).GET("/v1/store/agent/leads/{leadId}/activities", { params: { path: { leadId }, query: { limit: 100 } } });
  return data?.data ?? [];
}

/** My quotes on behalf (`store.agentQuotes.list`), of one lead or all. */
export async function getAgentQuotes(
  query: { leadId?: string; status?: AgentQuote["status"]; page?: number } = {},
): Promise<Page<AgentQuote>> {
  const { data } = await (await api()).GET("/v1/store/agent/quotes", {
    params: {
      query: {
        ...(query.leadId ? { leadId: query.leadId } : {}),
        ...(query.status ? { status: query.status } : {}),
        page: query.page ?? 1,
        perPage: 25,
      },
    },
  });
  return data!;
}

export async function getAgentQuote(agentQuoteId: string): Promise<AgentQuote | null> {
  try {
    const { data } = await (
      await api()
    ).GET("/v1/store/agent/quotes/{agentQuoteId}", { params: { path: { agentQuoteId } } });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) return null;
    throw error;
  }
}

/** Every round of a quote's discount requests, oldest first (`store.agentQuotes.discountRequests`). */
export async function getDiscountRequests(agentQuoteId: string): Promise<DiscountRequest[]> {
  const { data } = await (
    await api()
  ).GET("/v1/store/agent/quotes/{agentQuoteId}/discount-requests", { params: { path: { agentQuoteId } } });
  return data ?? [];
}

/** The published playbook cards for the agent, for one context or all (`store.agentPlaybook.get`). */
export async function getPlaybook(context?: PlaybookContext): Promise<PlaybookCard[]> {
  const { data } = await (
    await api()
  ).GET("/v1/store/agent/playbook", { params: { query: context ? { context } : {} } });
  return data?.data ?? [];
}

/** Expected commission per order with its expected payable date (`store.agentCommissions.forecast`, F47). */
export async function getForecast(): Promise<CommissionForecast> {
  const { data } = await (await api()).GET("/v1/store/agent/commissions/forecast");
  return data!;
}

export type QuotableProduct = Schemas["StoreProductCardDto"];

/**
 * The products an agent can price on a lead's behalf (D-468 §2: instant products only — the same public catalogue
 * getpack.co shows, read through the agent zone's allow-list).
 */
export async function getQuotableProducts(): Promise<QuotableProduct[]> {
  const { data } = await (await api()).GET("/v1/store/catalog/products", { params: { query: { perPage: 60 } } });
  return (data?.data ?? []).filter((product) => product.availability === "instant");
}
