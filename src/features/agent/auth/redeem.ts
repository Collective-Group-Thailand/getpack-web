"use server";

import { requestFingerprint } from "@/features/shared/handoff/fingerprint.server";
import { startSession } from "@/features/shared/auth/session-actions";
import { serverCallContext } from "@/lib/api/call-context.server";
import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";

/**
 * Redeems a storefront hand-off code on this host (D-467, `auth.customerHandoff.redeem`): this server derives the
 * same fingerprint the storefront's server sent, the API answers with a new getpack Agent session, and its tokens
 * go into this host's own httpOnly cookies. Every refusal is the API's one neutral `auth.handoff_invalid`.
 */
export async function redeemHandoff(code: string): Promise<{ ok: true } | { ok: false; code: string }> {
  if (typeof code !== "string" || code.length < 1 || code.length > 128)
    return { ok: false, code: "auth.handoff_invalid" };
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
    const { data } = await api.POST("/v1/auth/customer/handoff/actions/redeem", {
      body: { code, fingerprint: await requestFingerprint() },
    });
    if (!data) return { ok: false, code: "auth.handoff_invalid" };
    await startSession(data);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: isApiError(error) && error.status === 429 ? "http.too_many_requests" : "auth.handoff_invalid",
    };
  }
}
