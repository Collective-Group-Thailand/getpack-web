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
  // Loyalty P2 (2026-11-04, API-CHANGES-P2): engagement, lifecycle, segments and analytics, built in parallel on
  // getpack-api `feat/loyalty-p2-lifecycle`.
  "POST /v1/store/promotions/{promotionId}/actions/add-bundle",
  "GET /v1/store/loyalty/campaigns",
  "POST /v1/store/orders/{orderId}/review/photos",
  "GET /v1/store/loyalty/data-refresh",
  "POST /v1/store/loyalty/data-refresh/actions/confirm",
  "GET /v1/store/loyalty/showcase-consent",
  "PUT /v1/store/loyalty/showcase-consent",
  "GET /v1/store/surveys/next",
  "GET /v1/store/surveys/{surveyId}",
  "POST /v1/store/surveys/{surveyId}/actions/seen",
  "POST /v1/store/surveys/{surveyId}/actions/dismiss",
  "POST /v1/store/surveys/{surveyId}/responses",
  "GET /v1/admin/loyalty/analytics",
  "GET /v1/admin/loyalty/campaigns",
  "GET /v1/admin/promotions/{promotionId}/audience-estimate",
  "GET /v1/admin/promotions/agent-performance",
  "GET /v1/admin/surveys/templates",
  "POST /v1/admin/surveys/templates",
  "GET /v1/admin/surveys/templates/{templateId}",
  "PATCH /v1/admin/surveys/templates/{templateId}",
  "POST /v1/admin/surveys/templates/{templateId}/actions/{action}",
  "GET /v1/admin/surveys/templates/{templateId}/results",
  "GET /v1/admin/showcase-consents",
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
