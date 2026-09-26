"use client";

import { browserApi } from "@/lib/api/browser";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";

/**
 * What a customer is asked right after signing in — through the BFF, with the session the
 * sign-in just set, like every other customer call.
 *
 *   consent   every required purpose not granted, or granted at an older version (PDPA; Packio's
 *             own consent records, D-005), plus the optional ones never answered
 *   profile   no e-mail yet — the progressive-profiling step (CONTRACT-REQUEST store.profile)
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

export function needsProfile(me: Onboarding["me"]): boolean {
  return me !== null && !me.email;
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

export async function saveProfile(profile: {
  displayName?: string;
  email?: string;
  customerType?: "individual" | "juristic" | "government";
}): Promise<void> {
  await browserRequests().call("PATCH /v1/store/me", { body: profile });
}
