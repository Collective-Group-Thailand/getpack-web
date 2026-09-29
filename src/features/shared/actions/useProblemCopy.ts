import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { isApiError } from "@/lib/api/problem";
import { problemCopy, type ProblemCopy } from "@/lib/api/problem-copy";

/**
 * `(error) => { title, detail } | null` for a failed call, in the current locale: this app's
 * title for the problem `code` and the API's detail (`src/lib/api/problem-copy.ts`).
 */
export function useProblemCopy(): (error: unknown) => ProblemCopy | null {
  const t = useTranslations("problems");
  return useCallback((error: unknown) => (isApiError(error) ? problemCopy(error, t) : null), [t]);
}
