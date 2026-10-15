import { cookies } from "next/headers";

import { readAccessToken } from "@/lib/auth/session";

import { ClaimAgentLink } from "./ClaimAgentLink";
import { AGENT_COOKIE } from "./cookie";

/** Mounts the claim only for a signed-in customer holding an agent code (D-417). */
export async function AgentLinkClaim() {
  const jar = await cookies();
  const code = jar.get(AGENT_COOKIE)?.value;
  if (!code || !/^[A-Z0-9]{6,12}$/.test(code) || !readAccessToken(jar)) return null;
  return <ClaimAgentLink code={code} />;
}
