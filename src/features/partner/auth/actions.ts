"use server";

import { redirect } from "next/navigation";

import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { safeReturnTo } from "@/features/shared/auth/return-to";
import { startSession } from "@/features/shared/auth/session-actions";

export interface PartnerLoginState {
  errorKey?: string;
  requestId?: string;
}

/**
 * Partner-factory sign-in.
 *
 * The device PIN is optional and sent only when filled: whether a given factory's shared
 * shop-floor devices require one is a policy the backend owns, and is still open in its
 * ADR-0004 — so the UI offers the field and lets the API decide.
 */
export async function signInPartner(_state: PartnerLoginState, formData: FormData): Promise<PartnerLoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const devicePin = String(formData.get("devicePin") ?? "").trim();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  if (!username || !password) return { errorKey: "errors.invalidPartnerCredentials" };

  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl() });
    const { data } = await api.POST("/v1/auth/partner/login", {
      body: { username, password, ...(devicePin ? { devicePin } : {}) },
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
