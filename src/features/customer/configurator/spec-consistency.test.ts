// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { createApiClient } from "@/lib/api/client";

import { buildCalculateBody, type CorrugateConfiguration } from "./build";
import { initialState, readyToPrice, type Configurator } from "./state";

/**
 * B-API-3 / D-441 / D-443: one product, one spec, one price. The listing card, the product page's
 * price hint and the configurator's opening calculation say the same words and the same figure —
 * and the configurator opens on the API's default spec, which prints the outside only
 * (`printModel.<side>.default`: outside CMYK, inside none), so the price panel prices that spec.
 * The mock's corrugated box stands for `uat-postal-box-b`.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const SLUG = "shipping-box";
const api = () => createApiClient({ baseUrl: "http://api.mock" });

describe("card == product page == configurator opening", () => {
  it("shows one label and one starting price, and prints the outside only", async () => {
    const client = api();
    const cards = await client.GET("/v1/store/catalog/products", { params: { query: {} } });
    const card = cards.data!.data.find((item) => item.slug === SLUG)!;
    const hints = await client.GET("/v1/store/catalog/price-hints", { params: { query: { slugs: [SLUG] } } });
    const hint = hints.data!.find((entry) => entry.key === SLUG)!;
    const { data } = await client.GET("/v1/store/catalog/products/{slug}/configurator", {
      params: { path: { slug: SLUG } },
    });
    const configurator = data as Configurator;

    // The configurator opens on its default spec; its first calculation is that spec's price.
    const state = initialState(configurator);
    expect(readyToPrice(configurator, state)).toBe(true);
    const body = buildCalculateBody(configurator, state);
    const part = (body.configuration as CorrugateConfiguration).parts[0]!;
    expect(part.printFront).toHaveLength(1);
    expect(part.printFront?.[0]?.inkColourId).toBe(configurator.printModel!.outside.cmyk!.inkColourId);
    expect(part.printBack).toEqual([]);

    const calculation = await client.POST("/v1/store/quotes/actions/calculate", { body });
    const opening = calculation.data!;

    const cardLabel = card.startingPriceAssumes!.label;
    expect(hint.basis!.label).toEqual(cardLabel);
    expect(configurator.defaultSpec!.specLabel).toEqual(cardLabel);
    expect(opening.specLabel).toEqual(cardLabel);
    // Print is worded by side (B-API-3): the outside is named, the unprinted inside is left out.
    expect(cardLabel.th).toContain("พิมพ์ด้านนอก: CMYK");
    expect(cardLabel.th).not.toContain("พิมพ์ด้านใน");

    // The same figure everywhere.
    const first = opening.steps.find((step) => step.quantity === configurator.defaultSpec!.quantity)!;
    expect(card.startingPricePerPiece).toBe(first.unitPrice);
    expect(hint.startingFromPerPiece).toBe(first.unitPrice);
  });
});
