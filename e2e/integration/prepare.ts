import { api, apiWithEtag, DEV_INSTANT_PRODUCT, staffToken } from "./support";

/**
 * Prepares the dev seed's catalogue for the launch path, as catalogue admins would before launch.
 *
 * The seed leaves every product type RFQ-only, so packio-api answers `instant: false` for every
 * product (`store-configurator.service.ts`: instant needs an instant type and a difficulty level)
 * and `pricing.not_instant` for every calculation. F9001's corrugate price list prices the seed's
 * corrugated test product (`dev-rsc-carton`, which has a difficulty level) end to end, so an Admin
 * switches the corrugated type to instant (`changeQuoteMode`, with a reason, D-100). The folding
 * test product is not priceable on the seed (its price list yields `not_priceable`), so folding
 * stays RFQ-only. Idempotent.
 *
 * Run by `scripts/integration-stack.sh` (through `scripts/integration-prepare.ts`) before any web
 * server reads the catalogue, because the storefront caches catalogue reads.
 */
export async function prepareCatalogue(): Promise<string[]> {
  const done: string[] = [];
  const admin = await staffToken("admin");
  const types = await api<{ data: { id: string; code: string; quoteMode: string }[] }>(
    "GET",
    "/v1/admin/catalog/product-types?q=corrugated",
    { token: admin },
  );
  const corrugated = types.data.find((row) => row.code === "corrugated");
  if (!corrugated) throw new Error("The dev seed has no corrugated product type");
  if (corrugated.quoteMode !== "instant") {
    const { etag } = await apiWithEtag(`/v1/admin/catalog/product-types/${corrugated.id}`, admin);
    await api("POST", `/v1/admin/catalog/product-types/${corrugated.id}/actions/change-quote-mode`, {
      token: admin,
      idempotent: true,
      ifMatch: etag,
      body: { quoteMode: "instant", reason: "integration: the dev factory F9001 holds a corrugate price list" },
    });
    done.push("corrugated → instant");
  }
  // U2.F1: the Structure Advisor answers customers only with its flag on (D-237). The dev seed
  // carries the proposed rule set and F9001's signed board sheets; a Superadmin switches it on
  // here, as the business would once the golden cases are signed (D-189).
  const superadmin = await staffToken("superadmin");
  const flags = await api<{ key: string; enabled: boolean }[] | { data: { key: string; enabled: boolean }[] }>(
    "GET",
    "/v1/admin/feature-flags",
    { token: superadmin },
  );
  const advisor = (Array.isArray(flags) ? flags : flags.data).find((flag) => flag.key === "advisory.structure_advisor");
  if (advisor && !advisor.enabled) {
    await api("PUT", "/v1/admin/feature-flags/advisory.structure_advisor", {
      token: superadmin,
      body: { enabled: true },
    });
    done.push("advisory.structure_advisor → on");
  }
  const configurator = await api<{ instant: boolean }>(
    "GET",
    `/v1/store/catalog/products/${DEV_INSTANT_PRODUCT}/configurator`,
  );
  if (!configurator.instant) throw new Error(`${DEV_INSTANT_PRODUCT} is still not priced online`);
  return done;
}
