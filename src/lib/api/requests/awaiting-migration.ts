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
  // Contract v0.4.0–v0.6.0 (2026-10-01) published every request packio-api's U-B0 groups built.
  // U-F0.4 migrates all three zones off them; each zone's block empties as its screens move.
  // partner (U-F0.4)
  "GET /v1/partner/factories/{factoryId}/billing-statements",
  "GET /v1/partner/factories/{factoryId}/billing-statements/{statementId}",
  "GET /v1/partner/factories/{factoryId}/capacity-calendar",
  "GET /v1/partner/factories/{factoryId}/change-requests",
  "GET /v1/partner/factories/{factoryId}/claims",
  "GET /v1/partner/factories/{factoryId}/claims/{claimId}",
  "GET /v1/partner/factories/{factoryId}/jobs",
  "GET /v1/partner/factories/{factoryId}/jobs/lookup",
  "GET /v1/partner/factories/{factoryId}/jobs/{jobId}",
  "GET /v1/partner/factories/{factoryId}/payout-schedule",
  "GET /v1/partner/factories/{factoryId}/payouts",
  "GET /v1/partner/factories/{factoryId}/payouts/{payoutId}",
  "GET /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence",
  "GET /v1/partner/factories/{factoryId}/references",
  "GET /v1/partner/factories/{factoryId}/scorecards",
  "GET /v1/partner/factories/{factoryId}/ship-plan",
  "GET /v1/partner/factories/{factoryId}/shipments",
  "GET /v1/partner/factories/{factoryId}/shipments/{shipmentId}",
  "GET /v1/partner/factories/{factoryId}/site-visits",
  "GET /v1/partner/factories/{factoryId}/statement-of-account",
  "GET /v1/partner/factories/{factoryId}/today",
  "GET /v1/partner/factories/{factoryId}/users",
  "GET /v1/partner/me/notification-preferences",
  "PATCH /v1/partner/factories/{factoryId}/users/{userId}",
  "POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/confirm",
  "POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/dispute",
  "POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/tax-invoices",
  "POST /v1/partner/factories/{factoryId}/change-requests",
  "POST /v1/partner/factories/{factoryId}/claims/{claimId}/actions/respond",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/accept",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/reject",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues/{issueId}/actions/resolve",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/complete",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/start",
  "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/qc-checks",
  "POST /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence",
  "POST /v1/partner/factories/{factoryId}/shipments",
  "POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/dispatch",
  "POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/request-carrier",
  "POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/pod",
  "POST /v1/partner/factories/{factoryId}/users",
  "PUT /v1/partner/me/notification-preferences",
  // store (U-F0.4)
  "DELETE /v1/store/designs/{designId}/share",
  "DELETE /v1/store/me/company/brand-assets/{assetId}",
  "DELETE /v1/store/me/identities/{provider}",
  "GET /v1/store/catalog/price-hints",
  "GET /v1/store/catalog/product-categories",
  "GET /v1/store/catalog/products/{slug}/configurator",
  "GET /v1/store/catalog/products/{slug}/faqs",
  "GET /v1/store/designer/catalog",
  "GET /v1/store/designer/templates/{templateId}",
  "GET /v1/store/instalments",
  "GET /v1/store/me/company/brand-assets",
  "GET /v1/store/me/company/spend",
  "GET /v1/store/me/privacy-requests",
  "GET /v1/store/orders/{orderId}/claim-form",
  "GET /v1/store/orders/{orderId}/reorder",
  "GET /v1/store/rfq-forms/{productTypeCode}",
  "GET /v1/store/shared-designs/{token}",
  "GET /v1/store/support-channels",
  "PATCH /v1/store/me/company/members/{memberId}",
  "POST /v1/store/designs/actions/import",
  "POST /v1/store/designs/{designId}/actions/duplicate",
  "POST /v1/store/designs/{designId}/actions/share",
  "POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore",
  "POST /v1/store/me/company/brand-assets",
  "POST /v1/store/me/company/bulk-reorders",
  "POST /v1/store/me/company/bulk-reorders/actions/preview",
  "POST /v1/store/me/company/credit-applications",
  "POST /v1/store/me/privacy-requests",
  "POST /v1/store/promotions/actions/check",
  "POST /v1/store/support/actions/contact",
  "POST /v1/store/support/actions/handoff",
  // admin (U-F0.4)
  "DELETE /v1/admin/saved-views/{viewId}",
  "GET /v1/admin/bank-statement-lines/{lineId}/suggestions",
  "GET /v1/admin/credit-note-reasons",
  "GET /v1/admin/customer-documents/{documentId}/deliveries",
  "GET /v1/admin/customers/{customerId}/consents",
  "GET /v1/admin/dashboard",
  "GET /v1/admin/depreciation-runs/preview",
  "GET /v1/admin/dunning-log",
  "GET /v1/admin/financial-reports/roll-forward",
  "GET /v1/admin/financial-reports/subledger-reconciliation",
  "GET /v1/admin/gateway-settlements",
  "GET /v1/admin/order-cancel-reasons",
  "GET /v1/admin/payout-runs/{runId}/items/{itemId}/documents",
  "GET /v1/admin/promotions/{promotionId}/coupon-batches",
  "GET /v1/admin/saved-views",
  "GET /v1/admin/search",
  "GET /v1/admin/slips/{slipId}/file",
  "GET /v1/admin/sod-rules",
  "GET /v1/admin/staff-directory",
  "POST /v1/admin/bank-statement-lines/{lineId}/actions/split",
  "POST /v1/admin/customer-documents/{documentId}/actions/resend",
  "POST /v1/admin/orders/actions/send-payment-reminders",
  "POST /v1/admin/orders/{orderId}/actions/send-payment-reminder",
  "POST /v1/admin/saved-views",
  "POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception",
  "POST /v1/admin/shipments/{shipmentId}/actions/split",
  "POST /v1/admin/shipments/{shipmentId}/carrier-quotes",
  "POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}",
  "PUT /v1/admin/promotions/priority",
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
