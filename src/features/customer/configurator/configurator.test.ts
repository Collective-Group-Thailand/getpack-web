// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { createRequestClient } from "@/lib/api/requests/client";
import { REQUESTS } from "@/lib/api/requests/registry";
import type { Schemas } from "@/lib/api/types";

import { buildCalculateBody, buildConfiguration, seedFromConfiguration } from "./build";
import {
  initialState,
  missingChoices,
  readyToPrice,
  sizeProblems,
  stepsOf,
  withTier,
  type Configurator,
} from "./state";

/**
 * The configurator's pure core against the mock API, which serves the configurator from the
 * back office's catalogue rows and prices what it is sent: the body the storefront builds is
 * the body the calculator accepts, for folding (the published DTO) and the generic shape.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });
const requests = (token?: string) =>
  createRequestClient(
    REQUESTS,
    createApiClient({ baseUrl: "http://api.mock", accessToken: token }) as unknown as Client<never>,
  );

async function configuratorOf(slug: string): Promise<Configurator> {
  return requests().call("GET /v1/store/catalog/products/{slug}/configurator", { path: { slug } });
}

async function price(body: ReturnType<typeof buildCalculateBody>) {
  const { data } = await anonymous().POST("/v1/store/quotes/actions/calculate", {
    body: body as unknown as Schemas["CalculateQuoteDto"],
  });
  return data!;
}

describe("the configurator state", () => {
  it("starts from the API's defaults, ready to price, with the steps this product has", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = initialState(configurator);
    expect(state.sizeMode).toBe("standard");
    expect(state.dims).toMatchObject({ l: 100, w: 100, d: 50 });
    expect(state.quantities).toContain(state.quantity);
    expect(missingChoices(configurator, state)).toEqual([]);
    expect(readyToPrice(configurator, state)).toBe(true);
    expect(stepsOf(configurator)).toEqual([
      "size",
      "material",
      "printing",
      "finishing",
      "assembly",
      "quantity",
      "delivery",
      "design",
    ]);
  });

  it("explains a size outside the pattern's rules, and stops pricing it", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = {
      ...initialState(configurator),
      sizeMode: "custom" as const,
      dims: { l: 10, w: 900, d: null, gusset: null },
    };
    expect(sizeProblems(configurator, state)).toEqual({
      l: { code: "min", limitMm: 30 },
      w: { code: "max", limitMm: 500 },
      d: { code: "required" },
    });
    expect(readyToPrice(configurator, state)).toBe(false);
  });

  it("keeps quantity tiers sorted, bounded and within the API's maximum", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    expect(withTier(configurator, [500, 1000], 750)).toEqual([500, 750, 1000]);
    expect(withTier(configurator, [500], 1)).toBeNull();
    expect(withTier(configurator, [1, 2, 3, 4, 5, 6], 7000)).toBeNull();
  });

  it("leaves out steps a product has nothing for", async () => {
    const configurator = await configuratorOf("product-label");
    expect(stepsOf(configurator)).not.toContain("assembly");
  });
});

describe("the calculate body", () => {
  it("is a folding configuration the calculator prices, per quantity", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = initialState(configurator);
    const body = buildCalculateBody(configurator, state);
    const configuration = body.configuration as Schemas["FoldingConfigurationDto"];
    expect(configuration.patternId).toBe(configurator.size.patterns[0]!.id);
    expect(configuration.difficultyLevelId).toBe(configurator.fixedInputs.difficultyLevelId);
    expect(configuration.parts[0]!.printFront).toHaveLength(4);

    const result = await price(body);
    expect(result.steps.map((step) => step.quantity)).toEqual(state.quantities);
    expect(result.steps.every((step) => step.instant && /^\d+\.\d{2}$/.test(step.grossAmount!))).toBe(true);
    // No postcode yet: delivery is not priced, and the dock says so.
    expect(result.steps[0]!.shippingPending).toBe(true);
    expect(body.deliveryPostcode).toBeUndefined();
  });

  it("prices delivery once there is a postcode", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const body = buildCalculateBody(configurator, { ...initialState(configurator), postcode: "10110" });
    expect(body.deliveryPostcode).toBe("10110");
    const result = await price(body);
    expect(result.steps[0]!.shippingPending).toBe(false);
  });

  it("is the generic shape for the other calculators", async () => {
    const configurator = await configuratorOf("stand-up-pouch");
    const state = initialState(configurator);
    const body = buildCalculateBody(configurator, state);
    expect(body.configuration).toMatchObject({ catalogProductId: configurator.catalogProductId, gusset: 0 });
    expect(Object.keys((body.configuration as { options: object }).options)).toContain("pouch_type");
    const result = await price(body);
    expect(result.steps.every((step) => step.instant)).toBe(true);
  });

  it("routes a size the factory cannot price to RFQ, explained, rather than failing", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = {
      ...initialState(configurator),
      sizeMode: "custom" as const,
      dims: { l: 480, w: 200, d: 100, gusset: null },
    };
    const result = await price(buildCalculateBody(configurator, state));
    expect(result.steps[0]).toMatchObject({ instant: false, reason: "no_price_path", grossAmount: null });
  });

  it("reopens a saved configuration where it was left", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const start = initialState(configurator);
    const material = configurator.groups.find((group) => group.kind === "material")!.options.at(-1)!.id;
    const changed = {
      ...start,
      sizeMode: "custom" as const,
      standardSizeCode: null,
      dims: { l: 180, w: 120, d: 60, gusset: null },
      choices: { ...start.choices, material: [material] },
      quantities: [2000, 5000],
      quantity: 5000,
    };
    const seed = seedFromConfiguration(
      configurator,
      buildConfiguration(configurator, changed) as unknown as Record<string, unknown>,
      5000,
    );
    const reopened = initialState(configurator, seed);
    expect(reopened.dims).toMatchObject({ l: 180, w: 120, d: 60 });
    expect(reopened.choices.material).toEqual([material]);
    expect(reopened.choices.print).toEqual(start.choices.print);
    expect(reopened.quantities).toEqual([2000, 5000]);
    expect(reopened.quantity).toBe(5000);
  });
});

describe("keeping the price", () => {
  it("saves a quotation, with validity and lines, and puts it in the cart", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = { ...initialState(configurator), postcode: "10110", mockupOption: "with_print" as const };
    const customer = requests(accessToken("customer"));
    const quote = await customer.call("POST /v1/store/quotes", {
      body: {
        productTypeCode: configurator.productTypeCode,
        catalogProductSlug: configurator.slug,
        configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
        quantity: state.quantity,
        deliveryPostcode: state.postcode,
        designOption: state.designOption,
        mockupOption: state.mockupOption,
        promoCode: "PACKIO10",
      },
    });
    expect(quote.lines.map((line) => line.lineType)).toEqual(expect.arrayContaining(["product", "mockup", "shipping"]));
    expect(quote.lines.find((line) => line.lineType === "mockup")?.oneOff).toBe(true);
    expect(quote.promotion).toMatchObject({ code: "PACKIO10", applied: true });
    expect(Date.parse(quote.validUntil)).toBeGreaterThan(Date.now() + 14 * 24 * 3600_000);

    const cart = await customer.call("POST /v1/store/cart/items", { body: { quoteId: quote.id } });
    expect(cart.items.some((item) => item.quote.id === quote.id)).toBe(true);
  });

  it("will not save a quotation without a session", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = initialState(configurator);
    await expect(
      requests().call("POST /v1/store/quotes", {
        body: {
          productTypeCode: configurator.productTypeCode,
          catalogProductSlug: configurator.slug,
          configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
          quantity: state.quantity,
          designOption: state.designOption,
          mockupOption: state.mockupOption,
        },
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("checks a promotion code without a session", async () => {
    const valid = await requests().call("POST /v1/store/promotions/actions/check", {
      body: { code: "packio10", productTypeCode: "folding_carton" },
    });
    expect(valid).toMatchObject({ code: "PACKIO10", valid: true });
    const wrongType = await requests().call("POST /v1/store/promotions/actions/check", {
      body: { code: "CORRUGATE5", productTypeCode: "folding_carton" },
    });
    expect(wrongType).toMatchObject({ valid: false, reason: "not_applicable" });
  });
});
