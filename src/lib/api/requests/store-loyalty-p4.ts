/**
 * Points & Deals P4 (loyalty earn expansion): which loyalty surfaces are open to the caller — the store side.
 *
 * CONTRACT: API-CHANGES-P4 — `docs/design/loyalty-earn-expansion/API-CHANGES-P4.md` is the contract getpack-api builds
 * on `feat/loyalty-p4-cofunding-controls`. Until that release is adopted (`pnpm gen:api --adopt`), the new operation
 * below is a request definition; `registry.test.ts` then names it for deletion.
 *
 * Published reads that gain fields in P4 — `store.publicConfig.get` (`loyaltySurfaces`, the anonymous view) and
 * `store.loyalty.tasks` (status `claimed_by_company`, D-508) — are the schemas here, read once from the published
 * responses (`features/shared/loyalty-p4/read.ts`). CONTRACT-REQUEST store.loyalty.p4-fields.
 *
 * Seven booleans only: `capacityDeals` is never in a store response (D-440, P4-PLAN §0.1 item 2), and there is no cohort,
 * stage or budget field — the customer is never told they are outside a rollout (D-510).
 */

import { z } from "zod";

import { request } from "./define";

/** The flags a store response carries, in the setting's order without `capacityDeals`. */
export const STORE_LOYALTY_SURFACES = [
  "deals",
  "dealsLiff",
  "redeem",
  "tierPerks",
  "checklist",
  "pointsLiff",
  "quoteRecovery",
] as const;

export const loyaltySurfaces = z
  .object({
    deals: z.boolean(),
    dealsLiff: z.boolean(),
    redeem: z.boolean(),
    tierPerks: z.boolean(),
    checklist: z.boolean(),
    pointsLiff: z.boolean(),
    quoteRecovery: z.boolean(),
  })
  .meta({ id: "LoyaltySurfacesDto" });

/** `LoyaltyTaskStatus` from P4 on (D-508). */
export const LOYALTY_TASK_STATUSES_P4 = ["todo", "held", "done", "claimed_by_company"] as const;

/** `params.surface` of the problem `loyalty.feature_disabled` (404). `capacityDeals` only on admin responses. */
export const LOYALTY_SURFACE_PROBLEMS = ["deals", "redeem", "tierPerks", "checklist", "capacityDeals"] as const;

export const storeLoyaltyP4Requests = {
  "GET /v1/store/loyalty/surfaces": request({
    request: "store.loyalty.surfaces",
    summary:
      "The loyalty surfaces open to me: the setting and, with a token, my rollout cohort; without one the anonymous view (open only at stage all)",
    decisions: ["D-509", "D-510"],
    public: true,
    response: loyaltySurfaces,
  }),
} as const;

export type LoyaltySurfaces = z.infer<typeof loyaltySurfaces>;
export type StoreLoyaltySurface = (typeof STORE_LOYALTY_SURFACES)[number];
export type LoyaltyTaskStatusP4 = (typeof LOYALTY_TASK_STATUSES_P4)[number];
