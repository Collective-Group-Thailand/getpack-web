"use client";

import { useTranslations } from "next-intl";

import { isBudgetExhausted, p4ProblemKey } from "@/features/shared/loyalty-p4/problems";

import { problemMessage } from "../console";

/**
 * A failed P4 call as one sentence: this zone's own words for the codes P4 adds (`marketing.p4Problems`, until the
 * release is adopted and they move to the shared problems copy), else the API's localised detail, else `fallback`.
 */
export function useP4Problem() {
  const t = useTranslations("marketing.p4Problems");
  return (error: unknown, fallback: string) => {
    if (isBudgetExhausted(error)) return t("loyalty_budget_exhausted");
    const key = p4ProblemKey(error);
    return key && t.has(key) ? t(key) : problemMessage(error, fallback);
  };
}
