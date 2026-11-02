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
