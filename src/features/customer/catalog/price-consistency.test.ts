// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { buildCalculateBody } from "@/features/customer/configurator/build";
import { initialState } from "@/features/customer/configurator/state";
import { bindFormat } from "@/features/shared/format/bind";
import { specLabelText } from "@/features/shared/spec-label";
import { createApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * D-441: one price per spec. For every instant product of the mock dataset, the "starting from"
 * figure on the listing card, on the product page (detail and price hint) and the price the
 * configurator opens on — its own default spec, priced through `store.quotes.calculate` at the same
 * quantity — are the same string, and each says the same spec label. The mocks are typed against the
 * generated contract; nothing here prices anything itself.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: the client takes `fetch` when it is made, after the mock server has patched it.
const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });
const format = bindFormat("th");

async function instantCards() {
  const api = anonymous();
  const cards: Schemas["StoreProductCardDto"][] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.GET("/v1/store/catalog/products", { params: { query: { page, perPage: 100 } } });
    cards.push(...data!.data);
    if (page * data!.meta.perPage >= data!.meta.total) break;
  }
  return cards.filter((card) => card.availability === "instant" && card.startingPricePerPiece !== null);
}

describe("one price and one spec label for a product, wherever it is shown", () => {
  it("is the same on the card, the product page and the configurator's default spec", async () => {
    const api = anonymous();
    const cards = await instantCards();
    // Not vacuous: the dataset has instant products with a starting price.
    expect(cards.length).toBeGreaterThanOrEqual(3);

    for (const card of cards) {
      const slug = card.slug;
      const assumes = card.startingPriceAssumes!;
      const [{ data: detail }, { data: hints }, { data: configurator }] = await Promise.all([
        api.GET("/v1/store/catalog/products/{slug}", { params: { path: { slug } } }),
        api.GET("/v1/store/catalog/price-hints", { params: { query: { slugs: [slug] } } }),
        api.GET("/v1/store/catalog/products/{slug}/configurator", { params: { path: { slug } } }),
      ]);
      const hint = hints!.find((entry) => entry.key === slug)!;
      const spec = configurator!.defaultSpec;
      expect(spec, `${slug} has a default spec`).not.toBeNull();

      // The configurator's price for that default spec, at the quantity the card assumes.
      const { data: calculation } = await api.POST("/v1/store/quotes/actions/calculate", {
        body: { productTypeCode: configurator!.productTypeCode, configuration: spec!.configuration } as never,
      });
      const step = calculation!.steps.find((entry) => entry.quantity === assumes.quantity)!;
      expect(step.instant).toBe(true);

      const shown = format.thb(step.unitPrice);
      expect(format.thb(card.startingPricePerPiece), `${slug} card`).toBe(shown);
      expect(format.thb(detail!.startingPricePerPiece), `${slug} product page`).toBe(shown);
      expect(format.thb(hint.startingFromPerPiece), `${slug} price hint (JSON-LD, product page)`).toBe(shown);
      expect(hint.basis!.quantity).toBe(assumes.quantity);
      expect(spec!.quantity).toBe(assumes.quantity);

      // The same spec, said once: card, product page, hint, default spec and the calculation itself.
      const label = specLabelText(calculation!.specLabel, "th");
      expect(label).not.toBeNull();
      expect(specLabelText(assumes.label, "th"), `${slug} card label`).toBe(label);
      expect(specLabelText(detail!.startingPriceAssumes!.label, "th"), `${slug} product label`).toBe(label);
      expect(specLabelText(hint.basis!.label, "th"), `${slug} hint label`).toBe(label);
      expect(specLabelText(spec!.specLabel, "th"), `${slug} default spec label`).toBe(label);
    }
  });

  it("opens the configurator on that same spec, so the first price on screen is the one the card showed", async () => {
    const api = anonymous();
    for (const card of await instantCards()) {
      const { data: configurator } = await api.GET("/v1/store/catalog/products/{slug}/configurator", {
        params: { path: { slug: card.slug } },
      });
      const state = initialState(configurator!);
      expect(state.quantity).toBe(card.startingPriceAssumes!.quantity);
      const body = buildCalculateBody(configurator!, state);
      const { data: calculation } = await api.POST("/v1/store/quotes/actions/calculate", { body });
      const step = calculation!.steps.find((entry) => entry.quantity === state.quantity)!;
      expect(step.unitPrice, `${card.slug} opening price`).toBe(card.startingPricePerPiece);
      expect(specLabelText(calculation!.specLabel, "th"), `${card.slug} opening label`).toBe(
        specLabelText(card.startingPriceAssumes!.label, "th"),
      );
    }
  });
});
