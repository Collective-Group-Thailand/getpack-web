"use client";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

/**
 * What a customer is asked right after signing in — through the BFF, with the session the
 * sign-in just set, like every other customer call.
 *
 *   consent   every required purpose not granted, or granted at an older version (PDPA; getpack's
 *             own consent records, D-005), plus the optional ones never answered
 *   profile   never saved (`CustomerProfileDto.profileCompletedAt` is null) — the progressive-
 *             profiling step. The e-mail is not asked: it comes from a verified sign-in (D-224).
 *
 * Saving sets `profileCompletedAt`; skipping does not, so "not now" is remembered in a first-party
 * cookie holding the customer's id — otherwise a customer who skipped would be asked at every
 * sign-in on this browser.
 */

export type Consent = Schemas["ConsentDto"];
export type ConsentSource = Schemas["ConsentSource"];

export interface Onboarding {
  consents: Consent[];
  profile: Schemas["CustomerProfileDto"] | null;
}

export async function loadOnboarding(): Promise<Onboarding> {
  const api = browserApi();
  const [consents, profile] = await Promise.all([
    api
      .GET("/v1/store/me/consents")
      .then((response) => response.data ?? [])
      .catch(() => []),
    api
      .GET("/v1/store/customer-profile")
      .then((response) => response.data ?? null)
      .catch(() => null),
  ]);
  return { consents, profile };
}

/** The purposes the consent step shows. Empty means there is nothing to ask. */
export function consentsToAsk(consents: readonly Consent[]): Consent[] {
  const requiredOpen = consents.some((consent) => consent.required && (consent.granted !== true || consent.outdated));
  if (!requiredOpen) return [];
  return consents.filter((consent) => consent.required || consent.granted === null || consent.outdated);
}

const PROFILE_ASKED_COOKIE = "pk_profile_asked";
const PROFILE_ASKED_MAX_AGE = 60 * 60 * 24 * 365;

function profileAskedFor(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${PROFILE_ASKED_COOKIE}=`))
    ?.slice(PROFILE_ASKED_COOKIE.length + 1);
}

export function needsProfile(profile: Onboarding["profile"], askedFor = profileAskedFor()): boolean {
  return profile !== null && profile.profileCompletedAt === null && askedFor !== profile.id;
}

/** The step was skipped — not asked again for this customer on this browser. */
export function rememberProfileAsked(customerId: string): void {
  document.cookie = `${PROFILE_ASKED_COOKIE}=${encodeURIComponent(customerId)}; path=/; max-age=${PROFILE_ASKED_MAX_AGE}; samesite=lax${
    window.location.protocol === "https:" ? "; secure" : ""
  }`;
}

/** One record per purpose, in order (`POST /v1/store/me/consents` takes one at a time). */
export async function recordConsents(
  choices: readonly { purpose: string; granted: boolean }[],
  source: ConsentSource,
): Promise<void> {
  const api = browserApi();
  for (const choice of choices) {
    await api.POST("/v1/store/me/consents", { body: { ...choice, source } });
  }
}

/** `store.customerProfile.update` under the `ETag` of the profile read just before it. */
export async function saveProfile(profile: Schemas["UpdateCustomerProfileDto"]): Promise<void> {
  const api = browserApi();
  const current = await api.GET("/v1/store/customer-profile");
  await api.PATCH("/v1/store/customer-profile", {
    params: { header: { "If-Match": current.response.headers.get("etag") ?? "" } },
    body: profile,
  });
}
