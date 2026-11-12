"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { isApiError } from "@/lib/api/problem";

/**
 * The words for a refusal: the shared `problems` copy for the code when there is one (so the agent reads the same
 * neutral sentence everywhere — `agents.lead_unavailable` never says who holds the lead, D-440), else the API's own
 * sentence, else a plain "try again".
 */
export function useProblemText(): (error: unknown) => string {
  const tProblems = useTranslations("problems");
  const t = useTranslations("agentSales.common");
  return useCallback(
    (error: unknown) => {
      if (isApiError(error)) return tProblems.has(error.code) ? tProblems(error.code) : error.detail || t("failed");
      return t("failed");
    },
    [t, tProblems],
  );
}

/** A fresh `Idempotency-Key` for one money-moving or irreversible call (api-conventions: one key per attempt). */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
