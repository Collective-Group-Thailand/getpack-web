"use server";

import { redirect } from "next/navigation";

import { requestFingerprint } from "@/features/shared/handoff/fingerprint.server";
import { AGENT_ZONE_PATHS } from "@/features/shared/agent/zone-paths";
import { safeReturnTo } from "@/features/shared/auth/return-to";
import { isApiError, serverApi } from "@/lib/api/server";
import { zoneOrigin } from "@/lib/zones/origin.server";

/**
 * "เปิด getpack Agent" (D-467): asks the API for a one-time code with this storefront session
 * (`auth.customerHandoff.create`, bound to this browser's fingerprint), then sends the browser to the agent zone's
 * hand-off page with the code in the URL **fragment** — which a browser never sends to a server, so the code stays
 * out of every access log (API-CHANGES-P2: "keep it out of server access logs"). The agent zone's server redeems it
 * and sets its own cookies. Without a storefront session, or if the API refuses, the agent zone's sign-in opens.
 */
export async function openAgentApp(formData: FormData): Promise<void> {
  const to = safeReturnTo(String(formData.get("to") ?? "/"));
  const origin = await zoneOrigin("agent");
  let code: string | null = null;
  try {
    const { data } = await (
      await serverApi("customer")
    ).POST("/v1/auth/customer/handoff", { body: { target: "agent", fingerprint: await requestFingerprint() } });
    code = data?.code ?? null;
  } catch (error) {
    if (!isApiError(error)) throw error;
  }
  if (!code) redirect(`${origin}${AGENT_ZONE_PATHS.signIn}`);
  redirect(`${origin}${AGENT_ZONE_PATHS.handoff}#code=${encodeURIComponent(code)}&to=${encodeURIComponent(to)}`);
}
