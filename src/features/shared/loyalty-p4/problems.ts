import { isApiError } from "@/lib/api/problem";

/**
 * Problem codes P4 adds (API-CHANGES-P4 "Error codes"). Until the release is adopted they are not in the contract, so
 * the shared `problems` namespace cannot hold them (`src/i18n/problems.test.ts` refuses a code the contract does not
 * have); each zone words them in its own namespace under `p4Problems.<code with _>` and this picks the key. On adoption
 * the titles move to `common/problems.json` and this file goes.
 */
export const P4_PROBLEM_CODES = [
  "loyalty.feature_disabled",
  "loyalty.budget_exhausted",
  "cofunding.deal_not_eligible",
  "cofunding.offer_exists",
  "cofunding.invalid_transition",
  "cofunding.response_closed",
  "cofunding.disabled",
  "settings.dedicated_editor",
  "settings.pending_exists",
] as const;

/** The message key for a P4 problem (`cofunding_offer_exists`), or null for any other error. */
export function p4ProblemKey(error: unknown): string | null {
  if (!isApiError(error) || !error.code) return null;
  return (P4_PROBLEM_CODES as readonly string[]).includes(error.code) ? error.code.replace(/\./g, "_") : null;
}

/** Whether the API refused because the month's programme budget is used up (D-507), in either form. */
export function isBudgetExhausted(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.code === "loyalty.budget_exhausted") return true;
  return error.code === "promotions.not_publishable" && (error.errors ?? []).some((e) => e.code === "budget_exhausted");
}
