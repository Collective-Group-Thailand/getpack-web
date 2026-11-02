import "server-only";

import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
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

/**
 * The programme for an agent, or a redirect to `/account/agent` — the offer and the application —
 * for anyone who is not one yet: the agent's own pages would only get a refusal from the API.
 */
export async function requireAgent(): Promise<AgentProgramme> {
  const programme = await getProgramme();
  if (programme.state === "agent") return programme;
  return redirect({ href: "/account/agent", locale: await getLocale() });
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

export type MyTaxDeclaration = Schemas["MyTaxDeclarationDto"];

/** My ล.ย.01 of the current tax year (`store.agentTaxDeclaration.get`, D-465). */
export async function getMyTaxDeclaration(): Promise<MyTaxDeclaration> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/agent/tax-declaration");
  return data!;
}

export type PublicAgentProgramme = Schemas["PublicAgentProgrammeDto"];

/** The programme as the public landing shows it (`store.agentProgramme.public`, anonymous, D-466). */
export async function getPublicProgramme(): Promise<PublicAgentProgramme> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/agent/programme/public");
  return data!;
}

export type MyPayoutProfile = Schemas["MyPayoutProfileDto"];

/** My payout profile (`store.agentPayoutProfile.get`, D-466) with the ETag a save needs. */
export async function getMyPayoutProfile(): Promise<{ data: MyPayoutProfile; etag: string | null }> {
  const { data, response } = await (await serverApi("customer")).GET("/v1/store/agent/payout-profile");
  return { data: data!, etag: response.headers.get("ETag") };
}
