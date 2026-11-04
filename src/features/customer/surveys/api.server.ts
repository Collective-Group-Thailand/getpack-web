import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";
import type { SurveyInstance } from "@/lib/api/requests/store-loyalty-p2";

/**
 * Loyalty P2 survey reads for Server Components (CONTRACT-REQUEST store.surveys). The invitation is a convenience: a
 * failed read hides it, never the page (the account pages' rule).
 */

/** The one open survey to show now, or null. */
export async function getNextSurvey(): Promise<SurveyInstance | null> {
  try {
    return (await (await serverRequests("customer")).call("GET /v1/store/surveys/next")).survey;
  } catch {
    return null;
  }
}

/** One of my survey instances by its link; null when it is gone (404). Any other failure is the page's error. */
export async function getSurvey(surveyId: string): Promise<SurveyInstance | null> {
  try {
    return (await (await serverRequests("customer")).call("GET /v1/store/surveys/{surveyId}", { path: { surveyId } }))
      .survey;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
