/**
 * Contract requests packio-api has since published, still served by their request definitions.
 *
 * Adopting the B2–B6 contract (2026-09-28) made 86 requests real at once. Moving each screen to
 * `serverApi` / `browserApi` means following the published shape, which can differ from the one
 * asked for — screen by screen, each its own change (ADR-0006). Until then they stay here, and
 * `registry.test.ts` holds the list to two rules: nothing new may join it (a request the backend
 * has shipped fails the test unless it is listed), and an entry leaves as soon as its request
 * is deleted — so the list only shrinks.
 */
export const PUBLISHED_AWAITING_MIGRATION: readonly string[] = [
  "GET /v1/admin/analytics/campaigns",
  "GET /v1/admin/analytics/demand",
  "GET /v1/admin/analytics/factories",
  "GET /v1/admin/analytics/unmet-demand",
  "GET /v1/admin/campaigns",
  "GET /v1/admin/campaigns/{campaignId}",
  "GET /v1/admin/claims",
  "GET /v1/admin/claims/{claimId}",
  "GET /v1/admin/inspections",
  "GET /v1/admin/promotions",
  "GET /v1/admin/promotions/{promotionId}",
  "GET /v1/admin/reports",
  "GET /v1/admin/rfqs",
  "GET /v1/admin/rfqs/{rfqId}",
  "GET /v1/admin/shipments",
  "GET /v1/admin/shipments/{shipmentId}",
  "GET /v1/partner/factories/{factoryId}/payouts",
  "GET /v1/partner/factories/{factoryId}/scorecards",
  "GET /v1/partner/factories/{factoryId}/users",
  "GET /v1/store/catalog/products/{slug}/configurator",
  "PATCH /v1/admin/campaigns/{campaignId}",
  "PATCH /v1/admin/promotions/{promotionId}",
  "POST /v1/admin/campaigns",
  "POST /v1/admin/campaigns/{campaignId}/actions/{action}",
  "POST /v1/admin/inspections/{inspectionId}/actions/record",
  "POST /v1/admin/promotions",
  "POST /v1/admin/promotions/{promotionId}/actions/{action}",
  "POST /v1/admin/rfqs/{rfqId}/actions/assign",
  "POST /v1/admin/rfqs/{rfqId}/actions/decline",
  "POST /v1/admin/rfqs/{rfqId}/actions/request-info",
  "POST /v1/admin/rfqs/{rfqId}/consultations",
  "POST /v1/admin/rfqs/{rfqId}/messages",
  "POST /v1/admin/shipments/{shipmentId}/actions/book-carrier",
  "POST /v1/partner/factories/{factoryId}/users",
];

/**
 * Customer-zone operations published after U-F0.2 closed the zone, parked here on purpose.
 *
 * `store.catalog.getConfigurator` arrived with contract v0.3.0 (2026-09-30), during U-F0.3. The
 * configurator is rebuilt on the published shape by U2.F1 (configurator v2, RUN-ORDER §1 row 3), so
 * moving it twice is wasted work (user decision 2026-09-30). The customer-zone gate in
 * `registry.test.ts` allows exactly these, and each leaves the moment its screen migrates.
 */
export const CUSTOMER_ZONE_PARKED: readonly string[] = ["GET /v1/store/catalog/products/{slug}/configurator"];
