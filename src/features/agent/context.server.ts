import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { currentPath, signInUrl } from "@/features/shared/auth/guard";
import { AGENT_ZONE_PATHS } from "@/features/shared/agent/zone-paths";
import type { CustomerMe } from "@/lib/api/types";
import { getActor } from "@/lib/auth/actor";

import { getAgentOrState, getProgramme, type Agent, type AgentProgramme } from "./api.server";

/**
 * Who is in getpack Agent and what they may see (D-467):
 *   agent      an active or suspended agent — the whole app;
 *   ended      the agreement has ended — statements and 50 ทวิ only (`agents.ended` on everything else);
 *   not-agent  a signed-in customer who is not an agent — one short screen pointing to getpack.co/agent.
 * Cached per render, so the layout and the page ask the API once.
 */
export type AgentZoneState =
  | { kind: "agent"; actor: CustomerMe; programme: AgentProgramme; agent: Agent }
  | { kind: "ended"; actor: CustomerMe; programme: AgentProgramme }
  | { kind: "not-agent"; actor: CustomerMe; programme: AgentProgramme };

export const getAgentZoneState = cache(async (): Promise<AgentZoneState | null> => {
  const actor = await getActor("agent");
  if (!actor) return null;
  const programme = await getProgramme();
  if (programme.state !== "agent") return { kind: "not-agent", actor, programme };
  const agent = await getAgentOrState();
  if (agent === "ended") return { kind: "ended", actor, programme };
  if (agent === null) return { kind: "not-agent", actor, programme };
  return { kind: "agent", actor, programme, agent };
});

/** The state, or a redirect to this zone's sign-in that brings the person back here. */
export async function requireAgentZone(): Promise<AgentZoneState> {
  const state = await getAgentZoneState();
  if (!state) redirect(await signInUrl(AGENT_ZONE_PATHS.signIn));
  return state;
}

/** For a page only an active or suspended agent sees: an ended agent goes to the statements, anyone else home. */
export async function requireActiveAgent(): Promise<Extract<AgentZoneState, { kind: "agent" }>> {
  const state = await requireAgentZone();
  if (state.kind === "agent") return state;
  redirect(state.kind === "ended" ? AGENT_ZONE_PATHS.statements : AGENT_ZONE_PATHS.home);
}

/** For the statements pages, which an ended agent still reads. */
export async function requireAgentRecords(): Promise<Exclude<AgentZoneState, { kind: "not-agent" }>> {
  const state = await requireAgentZone();
  if (state.kind === "not-agent") redirect(AGENT_ZONE_PATHS.home);
  return state;
}

/** Whether the browser is on a statements page, for the layout's ended-agent rule. */
export async function onRecordsPath(): Promise<boolean> {
  const path = await currentPath();
  return path === AGENT_ZONE_PATHS.statements || path.startsWith(`${AGENT_ZONE_PATHS.statements}/`);
}
