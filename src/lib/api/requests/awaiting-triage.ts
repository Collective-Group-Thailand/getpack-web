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
  // Loyalty P4 (2026-11-05, API-CHANGES-P4): surfaces, co-funding, programme budget, rollout and the funding split,
  // built in parallel on getpack-api `feat/loyalty-p4-cofunding-controls`.
  "GET /v1/store/loyalty/surfaces",
  "GET /v1/admin/promotions/{promotionId}/cofunding-candidates",
  "GET /v1/admin/promotions/{promotionId}/cofunding-offers",
  "POST /v1/admin/promotions/{promotionId}/cofunding-offers",
  "POST /v1/admin/cofunding-offers/{offerId}/actions/withdraw",
  "GET /v1/admin/cofunding-contributions",
  "GET /v1/admin/loyalty/programme-budget",
  "POST /v1/admin/loyalty/programme-budget/overrides",
  "GET /v1/admin/loyalty/rollout",
  "POST /v1/admin/loyalty/rollout/actions/advance",
  "POST /v1/admin/loyalty/rollout/actions/rollback",
  "GET /v1/admin/loyalty/rollout/cohort",
  "GET /v1/admin/loyalty/analytics/funding",
  "GET /v1/partner/cofunding-offers",
  "GET /v1/partner/cofunding-offers/{offerId}",
  "POST /v1/partner/cofunding-offers/{offerId}/actions/accept",
  "POST /v1/partner/cofunding-offers/{offerId}/actions/decline",
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
