"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { problemMessage, useProblemCopy } from "@/features/shared/actions";
import { isApiError } from "@/lib/api/problem";

/** Whether the API refused because the month's programme budget is used up (D-507), in either form. */
export function isBudgetExhausted(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.code === "loyalty.budget_exhausted") return true;
  return error.code === "promotions.not_publishable" && (error.errors ?? []).some((e) => e.code === "budget_exhausted");
}

/**
 * A failed loyalty / co-funding call as one sentence: the shared problem title for its code (`common/problems.json`,
 * the codes the contract documents), the budget title when a publish was refused for the used-up budget, else the
 * API's localised detail, else `fallback`.
 */
export function useLoyaltyProblem() {
  const copy = useProblemCopy();
  const t = useTranslations("problems");
  return useCallback(
    (error: unknown, fallback: string) => {
      if (isBudgetExhausted(error) && t.has("loyalty.budget_exhausted")) return t("loyalty.budget_exhausted");
      return copy(error)?.title ?? problemMessage(error, fallback);
    },
    [copy, t],
  );
}
