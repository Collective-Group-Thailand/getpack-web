import "server-only";

import { permanentRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { agentZonePathFor, searchOf } from "@/features/shared/agent/zone-paths";
import { redirect } from "@/i18n/navigation";
import { isApiError, serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";
import { zoneOrigin } from "@/lib/zones/origin.server";

export type AgentProgramme = Schemas["AgentProgrammeDto"];
export type AgentApplication = Schemas["AgentApplicationDto"];

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

export type PublicAgentProgramme = Schemas["PublicAgentProgrammeDto"];

/** The programme as the public landing shows it (`store.agentProgramme.public`, anonymous, D-466). */
export async function getPublicProgramme(): Promise<PublicAgentProgramme> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/agent/programme/public");
  return data!;
}

/**
 * An old agent page (`/account/agent/**`, P0–P1) now lives in getpack Agent (D-467): an agent gets a 308 to the
 * same page there, query string kept; anyone else who reaches a sub-page goes to `/account/agent`, the programme's
 * compact landing. `segments` are the parts after `/account/agent`.
 */
export async function routeOldAgentPage(
  segments: readonly string[],
  searchParams: Record<string, string | string[] | undefined>,
): Promise<never> {
  const programme = await getProgramme();
  const target = agentZonePathFor(segments, searchOf(searchParams));
  if (programme.state === "agent" && target) permanentRedirect(`${await zoneOrigin("agent")}${target}`);
  return redirect({ href: "/account/agent", locale: await getLocale() });
}
