/** The Structure Advisor desk's list (D-240), in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";

import { defineList } from "../console/resource";

export type Recommendation = Schemas["AdminAdvisoryRecommendationDto"];
export type AdvisoryOutcome = Schemas["AdvisoryOutcome"];

export const OUTCOMES = ["recommended", "no_board_meets_load"] as const satisfies readonly AdvisoryOutcome[];

export const recommendationsList = defineList<Recommendation>({
  key: "advisory_recommendation",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/advisory/recommendations", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.id,
  defaults: { filterKeys: ["outcome", "customerId"] },
});

/** The board the advisor recommended (or the closest one when none met the load). */
export function recommendedBoard(row: Recommendation) {
  const id = row.recommendedBoardId ?? row.closestBoardId;
  return row.options.find((option) => option.board.id === id)?.board ?? null;
}

/** What the run was about, from its logged inputs. */
export function inputsOf(row: Recommendation) {
  const inputs = row.inputs as {
    productTypeCode?: string;
    configuration?: Record<string, unknown>;
    deliveryPostcode?: string | null;
    load?: Schemas["AdvisoryLoadDto"];
  };
  return inputs;
}
