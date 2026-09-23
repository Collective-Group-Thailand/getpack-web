"use server";

import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { startSession } from "@/features/shared/auth/session-actions";
import type { OtpChallenge } from "./otp";

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
 * The challenge carries `expiresAt` and `resendAvailableAt`, and the sheet counts down from
 * those rather than from a cooldown of its own: the policy is the backend's, and the API is
 * what actually refuses an early resend.
 *
 * `purpose` is `login` here. The same endpoint serves `link_phone`, which is the flow for
 * attaching a number to an account signed in through LINE or Firebase (F3).
 */
export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl() });
    const { data } = await api.POST("/v1/auth/customer/otp/request", {
      body: { phone, purpose: "login" },
    });
    return data ? { challenge: data } : { errorKey: "errors.unavailable" };
  } catch (error) {
    return { ...otpErrorFor(error) };
  }
}

/**
 * Exchange an OTP for a customer session.
 *
 * The challenge id is what identifies the attempt — the phone number is not sent again, so a
 * code issued for one number cannot be replayed against another.
 */
export async function verifyOtp(challengeId: string, code: string): Promise<OtpVerifyResult> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl() });
    const { data } = await api.POST("/v1/auth/customer/otp/verify", { body: { challengeId, code } });
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
