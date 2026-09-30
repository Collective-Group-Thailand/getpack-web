"use client";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

/**
 * What a customer is asked right after signing in — through the BFF, with the session the
 * sign-in just set, like every other customer call.
 *
 *   consent   every required purpose not granted, or granted at an older version (PDPA; Packio's
 *             own consent records, D-005), plus the optional ones never answered
 *   profile   no e-mail yet and not asked before — the progressive-profiling step
 *
 * CONTRACT-GAP store.profile — `store.customerProfile.update` cannot write the e-mail and nothing
 * says the step was answered, so "asked before" is remembered here, in a first-party cookie
 * holding the customer's id: without it, a customer with no e-mail would be asked at every
 * sign-in.
 */

export type Consent = Schemas["ConsentDto"];
export type ConsentSource = Schemas["ConsentSource"];

export interface Onboarding {
  consents: Consent[];
  me: Schemas["StoreMeDto"] | null;
}

export async function loadOnboarding(): Promise<Onboarding> {
  const api = browserApi();
  const [consents, me] = await Promise.all([
    api
      .GET("/v1/store/me/consents")
      .then((response) => response.data ?? [])
      .catch(() => []),
    api
      .GET("/v1/store/me")
      .then((response) => response.data ?? null)
      .catch(() => null),
  ]);
  return { consents, me };
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

export function needsProfile(me: Onboarding["me"], askedFor = profileAskedFor()): boolean {
  return me !== null && !me.email && askedFor !== me.id;
}

/** The step was answered (saved or skipped) — not asked again for this customer. */
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
