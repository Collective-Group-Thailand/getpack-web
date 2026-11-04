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
  // Loyalty P1 (2026-11-04, API-CHANGES-P1): the earn checklist and the packaging profile, built in parallel on
  // getpack-api `feat/loyalty-p1-activity-rewards`.
  "GET /v1/store/loyalty/tasks",
  "GET /v1/store/loyalty/packaging-profile",
  "PUT /v1/store/loyalty/packaging-profile",
  // Loyalty P1.5 (2026-11-04, API-CHANGES-P15): the deals surface, built in parallel on getpack-api
  // `feat/loyalty-p15-deals-surface`.
  "GET /v1/store/promotions",
  "GET /v1/store/promotions/{slug}",
  "POST /v1/store/promotions/{promotionId}/actions/save",
  "GET /v1/store/cart/applicable-codes",
  "GET /v1/store/quotations/{quotationId}/ladder",
  "GET /v1/store/pricing/ladder",
  "POST /v1/admin/promotions/{promotionId}/hero-image",
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
