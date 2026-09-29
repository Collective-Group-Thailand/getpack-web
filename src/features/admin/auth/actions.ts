"use server";

import { redirect } from "next/navigation";

import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { serverCallContext } from "@/lib/api/call-context.server";
import { startSession } from "@/features/shared/auth/session-actions";

import { safeReturnTo } from "@/features/shared/auth/return-to";

export interface StaffLoginState {
  /** A message key in the `auth` namespace — never a sentence, so it stays translatable. */
  errorKey?: string;
  /** Shown small beside the error, for support to quote (design-system.md §4). */
  requestId?: string;
}

/**
 * Staff sign-in.
 *
 * A Server Action rather than a BFF call, because it is the one request that has to *set*
 * cookies, and because it keeps `/v1/auth/staff/login` off the admin BFF's allow-list
 * entirely — nothing the browser can reach can attempt a staff password.
 */
export async function signInStaff(_state: StaffLoginState, formData: FormData): Promise<StaffLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  if (!email || !password) return { errorKey: "errors.invalidCredentials" };

  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
    const { data } = await api.POST("/v1/auth/staff/login", { body: { email, password } });
    if (!data) return { errorKey: "errors.unavailable" };

    await startSession(data);
  } catch (error) {
    if (isApiError(error)) {
      // 401 and 422 are both "those credentials are not right". Saying which of the two —
      // or which field was wrong — would tell an attacker whether the address exists.
      if (error.status === 401 || error.status === 422) {
        return { errorKey: "errors.invalidCredentials", requestId: error.requestId };
      }
      if (error.status === 429) return { errorKey: "errors.rateLimited", requestId: error.requestId };
      return { errorKey: "errors.unavailable", requestId: error.requestId };
    }
    return { errorKey: "errors.unavailable" };
  }

  // Outside the try: `redirect` works by throwing, and catching it here would turn a
  // successful sign-in into "signing in is not possible right now".
  redirect(returnTo);
}
