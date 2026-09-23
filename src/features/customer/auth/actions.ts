"use server";

import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { startSession } from "@/features/shared/auth/session-actions";
import type { SeedSchemas } from "@/lib/api/types";

export type OtpChallenge = SeedSchemas["OtpChallenge"];

export interface OtpRequestResult {
  challenge?: OtpChallenge;
  errorKey?: string;
  requestId?: string;
}

export interface OtpVerifyResult {
  ok?: true;
  errorKey?: string;
  requestId?: string;
}

/**
 * Ask for an OTP.
 *
 * The API answers with the policy — code length, expiry, cooldown, attempts left — and the
 * sheet renders those values rather than assuming them. No `D-###` owns these numbers yet
 * (see docs/contract-requests.md), and CLAUDE.md forbids the UI inventing what it is not told.
 */
export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl() });
    const { data } = await api.POST("/v1/auth/customer/otp/request", { body: { phone } });
    return data ? { challenge: data } : { errorKey: "errors.unavailable" };
  } catch (error) {
    return { ...otpErrorFor(error) };
  }
}

/** Exchange an OTP for a customer session. */
export async function verifyOtp(phone: string, ref: string, code: string): Promise<OtpVerifyResult> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl() });
    const { data } = await api.POST("/v1/auth/customer/otp/verify", { body: { phone, ref, code } });
    if (!data) return { errorKey: "errors.unavailable" };

    await startSession(data);
    return { ok: true };
  } catch (error) {
    return otpErrorFor(error);
  }
}

function otpErrorFor(error: unknown): { errorKey: string; requestId?: string } {
  if (!isApiError(error)) return { errorKey: "errors.unavailable" };

  // The API's `code` is stable and machine-readable (api-conventions §3), so the branch is on
  // that rather than on the localised sentence.
  if (error.code.endsWith("otp_expired")) return { errorKey: "errors.expiredOtp", requestId: error.requestId };
  if (error.status === 429) return { errorKey: "errors.rateLimited", requestId: error.requestId };
  if (error.status === 401) return { errorKey: "errors.invalidOtp", requestId: error.requestId };
  if (error.status === 422) return { errorKey: "errors.invalidPhone", requestId: error.requestId };
  return { errorKey: "errors.unavailable", requestId: error.requestId };
}
