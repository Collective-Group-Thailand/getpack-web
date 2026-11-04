import { OPERATION_TRIAGE } from "./triage";

/**
 * Contract requests written after getpack-api's last triage (`triage.ts`, `TRIAGE_SOURCE`).
 *
 * The triage says, per operation, whether getpack-api published it, published it in another shape,
 * or builds it in a U-B0 group. A request added since has no verdict yet; it is listed here so
 * `registry.test.ts` can tell "not triaged yet" from "forgotten", and it leaves as soon as
 * `pnpm gen:triage` brings in a verdict for it.
 */
export const AWAITING_TRIAGE: readonly string[] = [
  // U5.2 / U5.6 (2026-10-05): the glossary, the materials library and learning paths for customers.
  "GET /v1/store/catalog/glossary-terms",
  "GET /v1/store/catalog/materials",
  "GET /v1/store/learning-paths",
  // U5.5 (2026-10-06): whether the assistant is available to me.
  "GET /v1/store/assistant/availability",
  // U-F3 (2026-10-06): the footer's company identity, the newsletter sign-up.
  "GET /v1/store/company-identity",
  "POST /v1/store/newsletter/actions/subscribe",
  // U3.6 (2026-10-06): the staff a structural design request can be assigned to.
  "GET /v1/admin/structural-requests/designers",
  // Loyalty P3 (2026-11-04, API-CHANGES-P3): reward catalogue, tier perks, admin campaigns, credit uplift and capacity
  // deals, built in parallel on getpack-api `feat/loyalty-p3-catalogue-tiers`.
  "GET /v1/store/rewards",
  "POST /v1/store/rewards/{itemId}/actions/redeem",
  "GET /v1/store/rewards/redemptions",
  "POST /v1/store/rewards/redemptions/{redemptionId}/actions/cancel",
  "GET /v1/admin/loyalty/rewards",
  "POST /v1/admin/loyalty/rewards",
  "GET /v1/admin/loyalty/rewards/{itemId}",
  "PATCH /v1/admin/loyalty/rewards/{itemId}",
  "POST /v1/admin/loyalty/rewards/{itemId}/actions/{action}",
  "GET /v1/admin/loyalty/reward-redemptions",
  "POST /v1/admin/loyalty/reward-redemptions/{redemptionId}/actions/cancel",
  "POST /v1/admin/loyalty/campaigns",
  "GET /v1/admin/loyalty/campaigns/{campaignId}",
  "PATCH /v1/admin/loyalty/campaigns/{campaignId}",
  "POST /v1/admin/loyalty/campaigns/{campaignId}/actions/cancel",
  "PUT /v1/admin/companies/{companyId}/credit/uplift",
  "GET /v1/admin/credit-uplifts",
  "GET /v1/admin/promotions/capacity-deals",
];

/**
 * Whether getpack-api still has to build this operation — the ones `contract-requests.openapi.json`
 * carries: still to implement, or deferred by a decision until it is taken. A published operation
 * (as asked or in another shape) is the backend's contract now, even while a screen still calls it
 * through its request definition.
 */
export function isStillOpen(key: string): boolean {
  const triage = OPERATION_TRIAGE[key];
  return triage ? triage.verdict === "implement" || triage.verdict === "deferred" : AWAITING_TRIAGE.includes(key);
}
