import "server-only";

import { isApiError } from "@/lib/api/problem";
import type { SurveyInstance } from "@/features/shared/loyalty-p2/types";
import { serverApi } from "@/lib/api/server";

/**
 * Loyalty P2 survey reads for Server Components (`store.surveys.next` / `get`). The invitation is a convenience: a
 * failed read hides it, never the page (the account pages' rule).
 */

/** The one open survey to show now, or null. */
export async function getNextSurvey(): Promise<SurveyInstance | null> {
  try {
    const { data } = await (await serverApi("customer")).GET("/v1/store/surveys/next");
    return data!.survey;
  } catch {
    return null;
  }
}

/** One of my survey instances by its link; null when it is gone (404). Any other failure is the page's error. */
export async function getSurvey(surveyId: string): Promise<SurveyInstance | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/surveys/{surveyId}", {
      params: { path: { surveyId } },
    });
    return data!.survey;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
