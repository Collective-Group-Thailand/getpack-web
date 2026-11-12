"use client";

import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";

/**
 * A consent purpose in words (round 2, B8): the version's own summary when the DPO wrote one,
 * else the storefront's name for the purpose — never the key (`privacy_notice`). A purpose the
 * storefront does not know reads "ความยินยอม" with its key humanised, rather than the raw key.
 */
export function useConsentLabel() {
  const t = useTranslations("auth.consentPurposes");
  return (consent: Pick<Schemas["ConsentDto"], "purpose" | "summary">) => {
    if (consent.summary) return { name: consent.summary, description: null };
    if (t.has(`${consent.purpose}.name`)) {
      const description = t(`${consent.purpose}.description`);
      return { name: t(`${consent.purpose}.name`), description: description || null };
    }
    return { name: `${t("other.name")} (${consent.purpose.replace(/_/g, " ")})`, description: null };
  };
}
