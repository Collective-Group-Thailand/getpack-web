import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import enAdmin from "./messages/en/admin/partners.json";
import enPartner from "./messages/en/partner/prices.json";
import thAdmin from "./messages/th/admin/partners.json";
import thPartner from "./messages/th/partner/prices.json";

/**
 * Every price component the contract names needs a label in the partner price list and the admin
 * pricing tab. A contract bump that adds a component otherwise reaches the screen as
 * MISSING_MESSAGE. `satisfies` makes `pnpm typecheck` name the missing keys; the test keeps the two
 * catalogues of a locale in step.
 */
type Labels = Record<Schemas["PriceComponent"], string>;

const catalogues = {
  "th partnerPrices": thPartner.components satisfies Labels,
  "th partners": thAdmin.components satisfies Labels,
  "en partnerPrices": enPartner.components satisfies Labels,
  "en partners": enAdmin.components satisfies Labels,
};

describe("price component labels", () => {
  it("labels the same components in the partner and admin zones", () => {
    const keys = Object.values(catalogues).map((labels) => Object.keys(labels).sort());
    for (const other of keys.slice(1)) expect(other).toEqual(keys[0]);
  });
});
