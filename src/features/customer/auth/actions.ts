"use server";

import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { serverCallContext } from "@/lib/api/call-context.server";
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
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
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
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
    const { data } = await api.POST("/v1/auth/customer/otp/verify", { body: { challengeId, code } });
    if (!data) return { errorKey: "errors.unavailable" };

    await startSession(data);
    return { ok: true };
  } catch (error) {
    return otpErrorFor(error);
  }
}

export interface ProviderSignInResult {
  ok?: true;
  errorKey?: string;
  requestId?: string;
}

/**
 * Exchange a Firebase ID token (Google, Apple) for a customer session. The API verifies the
 * token and finds or creates the customer; it never links accounts by e-mail alone (B1.3).
 */
export async function signInWithFirebase(idToken: string): Promise<ProviderSignInResult> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
    const { data } = await api.POST("/v1/auth/customer/firebase", { body: { idToken } });
    if (!data) return { errorKey: "errors.unavailable" };
    await startSession(data);
    return { ok: true };
  } catch (error) {
    return providerErrorFor(error);
  }
}

/** Exchange a LINE ID token, or a LIFF access token inside the LINE app, for a customer session. */
export async function signInWithLine(identity: {
  idToken?: string;
  liffAccessToken?: string;
}): Promise<ProviderSignInResult> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), ...(await serverCallContext()) });
    const { data } = await api.POST("/v1/auth/customer/line", {
      body: { idToken: identity.idToken, liffAccessToken: identity.liffAccessToken },
    });
    if (!data) return { errorKey: "errors.unavailable" };
    await startSession(data);
    return { ok: true };
  } catch (error) {
    return providerErrorFor(error);
  }
}

function providerErrorFor(error: unknown): { errorKey: string; requestId?: string } {
  if (!isApiError(error)) return { errorKey: "errors.unavailable" };
  // 409: the provider identity already belongs to another customer (B1.3 never merges).
  if (error.status === 409) return { errorKey: "errors.providerConflict", requestId: error.requestId };
  if (error.status === 401 || error.status === 422) {
    return { errorKey: "errors.providerFailed", requestId: error.requestId };
  }
  if (error.status === 429) return { errorKey: "errors.rateLimited", requestId: error.requestId };
  return { errorKey: "errors.unavailable", requestId: error.requestId };
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

/**
 * Link a LINE account to the signed-in customer (F3 3.4, D-151). B1.3's LINE sign-in links a new
 * LINE identity to whoever the bearer token belongs to, so this is that call made with the
 * customer's own session, which the response then renews.
 */
export async function linkLine(identity: {
  idToken?: string;
  liffAccessToken?: string;
}): Promise<ProviderSignInResult> {
  try {
    const { serverApi } = await import("@/lib/api/server");
    const api = await serverApi("customer");
    const { data } = await api.POST("/v1/auth/customer/line", {
      body: { idToken: identity.idToken, liffAccessToken: identity.liffAccessToken },
    });
    if (!data) return { errorKey: "errors.unavailable" };
    await startSession(data);
    return { ok: true };
  } catch (error) {
    return providerErrorFor(error);
  }
}
