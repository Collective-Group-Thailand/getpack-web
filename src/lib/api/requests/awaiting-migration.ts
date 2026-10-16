/**
 * Contract requests getpack-api has since published, still served by their request definitions.
 *
 * Adopting the B2–B6 contract (2026-09-28) made 86 requests real at once. Moving each screen to
 * `serverApi` / `browserApi` means following the published shape, which can differ from the one
 * asked for — screen by screen, each its own change (ADR-0006). Until then they stay here, and
 * `registry.test.ts` holds the list to two rules: nothing new may join it (a request the backend
 * has shipped fails the test unless it is listed), and an entry leaves as soon as its request
 * is deleted — so the list only shrinks.
 */
export const PUBLISHED_AWAITING_MIGRATION: readonly string[] = [
  // Contract v0.4.0–v0.6.0 (2026-10-01) published every request getpack-api's U-B0 groups built,
  // U-F0.4 moved all three zones off them, and U-F0.5 moved the parked configurator (below).
];

/**
 * Customer-zone operations published after U-F0.2 closed the zone, parked here on purpose.
 *
 * `store.catalog.getConfigurator` (contract v0.3.0) was parked here for U2.F1 (user decision
 * 2026-09-30) until a thin adapter moved the configurator onto it in U-F0.5 (user decision
 * 2026-10-01, `features/customer/configurator/from-contract.ts`). The customer-zone gate in
 * `registry.test.ts` allows exactly these, and each leaves the moment its screen migrates.
 */
export const CUSTOMER_ZONE_PARKED: readonly string[] = [];
