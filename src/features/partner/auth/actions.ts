"use server";

import { redirect } from "next/navigation";

import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { serverCallContext } from "@/lib/api/call-context.server";
import { signInReturnTo } from "@/features/shared/auth/return-to";
import { startSession } from "@/features/shared/auth/session-actions";

export interface PartnerLoginState {
  errorKey?: string;
  requestId?: string;
}

/**
 * Partner-factory sign-in.
 *
 * `PartnerLoginDto` makes only `email` required: a shared shop-floor device can be enrolled
 * with a PIN instead of a password, so the API accepts either and decides which this factory
 * allows. The form offers both and sends what was filled, rather than guessing the policy —
 * which is still open in the backend's ADR-0004.
 *
 * `deviceId` identifies the shared device a PIN belongs to. It is sent only alongside a PIN,
 * because on its own it means nothing to the API.
 */
export async function signInPartner(_state: PartnerLoginState, formData: FormData): Promise<PartnerLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const returnTo = signInReturnTo(String(formData.get("returnTo") ?? ""));

  if (!email || (!password && !pin)) return { errorKey: "errors.invalidPartnerCredentials" };

  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
    const { data } = await api.POST("/v1/auth/partner/login", {
      body: {
        email,
        ...(password ? { password } : {}),
        ...(pin ? { pin, ...(deviceId ? { deviceId } : {}) } : {}),
      },
    });
    if (!data) return { errorKey: "errors.unavailable" };

    await startSession(data);
  } catch (error) {
    if (isApiError(error)) {
      if (error.status === 401 || error.status === 422) {
        return { errorKey: "errors.invalidPartnerCredentials", requestId: error.requestId };
      }
      if (error.status === 429) return { errorKey: "errors.rateLimited", requestId: error.requestId };
      return { errorKey: "errors.unavailable", requestId: error.requestId };
    }
    return { errorKey: "errors.unavailable" };
  }

  redirect(returnTo);
}
