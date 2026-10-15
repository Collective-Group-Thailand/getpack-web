import "server-only";

import { isApiError, serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type AgentProgramme = Schemas["AgentProgrammeDto"];
export type AgentApplication = Schemas["AgentApplicationDto"];
export type Agent = Schemas["AgentDto"];
export type AgentLink = Schemas["AgentLinkDto"];
export type AgentLead = Schemas["AgentLeadDto"];
export type AgentCommission = Schemas["AgentCommissionDto"];
export type AgentStatement = Schemas["AgentStatementDto"];
export type AgentStatementDetail = Schemas["AgentStatementDetailDto"];
export interface Page<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number };
}

/** The agreement, the standard plan and where the customer stands (`store.agent.programme`, D-416). */
export async function getProgramme(): Promise<AgentProgramme> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/agent/programme");
  return data!;
}

/** The latest application, or `null` when there is none (`store.agent.getApplication`). */
export async function getApplication(): Promise<AgentApplication | null> {
  try {
    const { data } = await (await serverApi("customer")).GET("/v1/store/agent/application");
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** My agent profile with totals (`store.agent.me`, `agent.self`). */
export async function getAgent(): Promise<Agent> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/agent");
  return data!;
}

export async function getMyCustomers(page = 1, status?: Schemas["AgentLinkStatus"]): Promise<Page<AgentLink>> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/agent/customers", {
    params: { query: { page, perPage: 25, ...(status ? { status } : {}) } },
  });
  return data!;
}

export async function getMyLeads(page = 1, status?: Schemas["AgentLeadStatus"]): Promise<Page<AgentLead>> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/agent/leads", {
    params: { query: { page, perPage: 25, ...(status ? { status } : {}) } },
  });
  return data!;
}

export async function getMyCommissions(
  page = 1,
  status?: Schemas["AgentCommissionStatus"],
): Promise<Page<AgentCommission>> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/agent/commissions", {
    params: { query: { page, perPage: 25, ...(status ? { status } : {}) } },
  });
  return data!;
}

export async function getMyStatements(page = 1): Promise<Page<AgentStatement>> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/agent/statements", {
    params: { query: { page, perPage: 25 } },
  });
  return data!;
}

export async function getMyStatement(statementId: string): Promise<AgentStatementDetail | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/agent/statements/{statementId}", {
      params: { path: { statementId } },
    });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
