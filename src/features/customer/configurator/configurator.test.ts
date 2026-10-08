// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { loadOf } from "./advisor";
import { buildCalculateBody, buildConfiguration, seedFromConfiguration } from "./build";
import { basesOf, groupsOf, isProcessInk, sizeKindOf, type Configurator } from "./model";
import {
  DEFAULT_LOAD,
  initialState,
  missingChoices,
  NO_DIMS,
  readyToPrice,
  sizeProblems,
  stepsOf,
  withTier,
  type ConfiguratorState,
} from "./state";
import { draftConfiguration } from "./useDraft";

/**
 * The configurator v2's pure core against the mock API, which serves the published configurator
 * from the back office's catalogue rows and prices what it is sent: the body the storefront
 * builds is each calculator's published configuration (contract v0.41.0), with the basis the
 * customer chose (D-182) and the target (D-247).
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });
const customer = () => createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer") });

async function configuratorOf(slug: string): Promise<Configurator> {
  const { data } = await anonymous().GET("/v1/store/catalog/products/{slug}/configurator", {
    params: { path: { slug } },
  });
  return data!;
}

async function price(body: ReturnType<typeof buildCalculateBody>) {
  const { data } = await anonymous().POST("/v1/store/quotes/actions/calculate", { body });
  return data!;
}

const custom = (state: ConfiguratorState, dims: Partial<ConfiguratorState["dims"]>, basis = state.basis) => ({
  ...state,
  sizeMode: "custom" as const,
  standardSizeCode: null,
  basis,
  dims: { ...NO_DIMS, ...dims },
});

describe("the configurator state", () => {
  it("starts from the API's defaults on a standard (inside) size, with the steps this product has", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = initialState(configurator);
    expect(state.sizeMode).toBe("standard");
    expect(state.basis).toBe("internal");
    expect(state.dims).toMatchObject({ l: 100, w: 100, d: 50 });
    expect(state.quantities).toContain(state.quantity);
    expect(missingChoices(configurator, state)).toEqual([]);
    expect(readyToPrice(configurator, state)).toBe(true);
    const steps = stepsOf(configurator);
    expect(steps[0]).toBe("size");
    expect(steps).toContain("printing");
    expect(steps.at(-1)).toBe("summary");
    expect(steps).not.toContain("logistics");
    expect(stepsOf(configurator, { advisor: true })).toContain("logistics");
  });

  it("asks for the basis of a typed size and never assumes one (D-182)", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    expect(basesOf(configurator)).toEqual(["internal", "external", "over_crease"]);
    const state = custom(initialState(configurator), { l: 120, w: 80, d: 60 }, null);
    expect(sizeProblems(configurator, state)).toEqual({ basis: { code: "basis_required" } });
    expect(readyToPrice(configurator, state)).toBe(false);
    expect(readyToPrice(configurator, { ...state, basis: "internal" })).toBe(true);
  });

  it("explains a size outside the style's inside limits, and stops pricing it", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = custom(initialState(configurator), { l: 10, w: 900 }, "internal");
    expect(sizeProblems(configurator, state)).toEqual({
      l: { code: "min", limitMm: 30, internalMm: null },
      w: { code: "max", limitMm: 500, internalMm: null },
      d: { code: "required" },
    });
    expect(readyToPrice(configurator, state)).toBe(false);
  });

  it("checks a size entered outside through the API's conversion, not as entered", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = custom(initialState(configurator), { l: 501, w: 200, d: 100 }, "external");
    // Until the conversion arrives, only the blanks are checked.
    expect(sizeProblems(configurator, state)).toEqual({});
    const { data: converted } = await anonymous().POST("/v1/store/specs/actions/convert-dimensions", {
      body: {
        productTypeCode: configurator.productTypeCode,
        basis: "external",
        l: 501,
        w: 200,
        d: 100,
        patternId: configurator.patterns[0]!.id,
        materialId: state.choices.material![0]!,
      },
    });
    expect(converted!.bases).toEqual(["internal", "external", "over_crease"]);
    const internal = converted!.sizes.internal!;
    expect(internal.l).toBeLessThan(501);
    expect(sizeProblems(configurator, state, internal).l).toBeUndefined();
    const tooWide = sizeProblems(configurator, state, { ...internal, w: 519.1 });
    expect(tooWide.w).toEqual({ code: "max", limitMm: 500, internalMm: 519.1 });
  });

  it("keeps quantity tiers sorted, bounded and within the API's maximum", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    expect(withTier(configurator, [500, 1000], 750)).toEqual([500, 750, 1000]);
    expect(withTier(configurator, [500], 1)).toBeNull();
    expect(withTier(configurator, [1, 2, 3, 4, 5, 6], 7000)).toBeNull();
  });

  it("leaves out steps a product has nothing for; a flat item has one basis, its finished size", async () => {
    const configurator = await configuratorOf("product-label");
    expect(sizeKindOf(configurator)).toBe("flat");
    expect(stepsOf(configurator)).not.toContain("assembly");
    expect(initialState(configurator).basis).toBe("product");
  });

  it("refuses a target that is not an amount in baht", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = initialState(configurator);
    expect(readyToPrice(configurator, { ...state, target: "12.5" })).toBe(true);
    expect(readyToPrice(configurator, { ...state, target: "0" })).toBe(false);
    expect(readyToPrice(configurator, { ...state, target: "1.234" })).toBe(false);
  });
});

describe("the calculate body", () => {
  it("is a folding configuration the calculator prices, on its basis, per quantity", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = initialState(configurator);
    const body = buildCalculateBody(configurator, state);
    const configuration = body.configuration as Schemas["FoldingConfigurationDto"];
    expect(configuration.patternId).toBe(configurator.patterns[0]!.id);
    expect(configuration.difficultyLevelId).toBe(configurator.difficultyLevelId);
    expect(configuration.basis).toBe("internal");

    const result = await price(body);
    expect(result.steps.map((step) => step.quantity)).toEqual(state.quantities);
    expect(result.steps.every((step) => step.instant && /^\d+\.\d{2}$/.test(step.grossAmount!))).toBe(true);
    // No postcode yet: delivery is not priced, and the dock says so.
    expect(result.steps[0]!.shippingPending).toBe(true);
    expect(body.deliveryPostcode).toBeUndefined();
    expect(result.dimensions).toMatchObject({ basis: "internal", pricedBasis: "internal" });
  });

  it("prints a process ink as one four-colour pass, another ink once (FoldingPartDto)", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const inks = groupsOf(configurator).find((group) => group.kind === "print_front")!.options;
    const process = inks.find(isProcessInk)!;
    const spot = inks.find((ink) => !isProcessInk(ink))!;
    const state = initialState(configurator);
    const printed = { ...state, choices: { ...state.choices, print_front: [process.id], print_back: [spot.id] } };
    const configuration = buildConfiguration(configurator, printed) as Schemas["FoldingConfigurationDto"];
    expect(configuration.parts[0]!.printFront).toEqual(Array(4).fill({ inkColourId: process.id, percent: 100 }));
    expect(configuration.parts[0]!.printBack).toEqual([{ inkColourId: spot.id, percent: 100 }]);
    const [plain, colour] = await Promise.all([
      price(buildCalculateBody(configurator, state)),
      price(buildCalculateBody(configurator, printed)),
    ]);
    expect(Number(colour.steps[0]!.unitPrice)).toBeGreaterThan(Number(plain.steps[0]!.unitPrice));
  });

  it("prices delivery once there is a postcode", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const body = buildCalculateBody(configurator, { ...initialState(configurator), postcode: "10110" });
    expect(body.deliveryPostcode).toBe("10110");
    const result = await price(body);
    expect(result.steps[0]!.shippingPending).toBe(false);
  });

  it("answers a target with the gap at each quantity (D-247)", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = { ...initialState(configurator), target: "0.50" };
    const body = buildCalculateBody(configurator, state);
    expect(body.targetPricePerUnit).toBe("0.50");
    const result = await price(body);
    expect(result.target?.targetPricePerUnit).toBe("0.50");
    expect(result.target?.steps.map((step) => step.quantity)).toEqual(state.quantities);
    expect(result.target?.steps.every((step) => !step.meetsTarget)).toBe(true);
    const generous = await price(buildCalculateBody(configurator, { ...state, target: "999.00" }));
    expect(generous.target?.steps.every((step) => step.meetsTarget)).toBe(true);
  });

  it("is a corrugate configuration for a corrugated box, with where the colours print", async () => {
    const configurator = await configuratorOf("shipping-box");
    const base = initialState(configurator);
    const ink = groupsOf(configurator).find((group) => group.kind === "print_front")?.options[0];
    const state = {
      ...custom(base, { l: 400, w: 300, d: 250 }, "internal"),
      choices: { ...base.choices, ...(ink ? { print_front: [ink.id] } : {}) },
    };
    expect(readyToPrice(configurator, state)).toBe(true);
    const body = buildCalculateBody(configurator, state);
    const configuration = body.configuration as Schemas["CorrugateConfigurationDto"];
    expect(configuration).toMatchObject({
      catalogProductId: configurator.catalogProductId,
      patternId: configurator.patterns[0]!.id,
      materialId: state.choices.material![0],
      difficultyLevelId: configurator.difficultyLevelId,
      quantities: state.quantities,
      basis: "internal",
    });
    if (ink) expect(configuration.parts[0]!.printFront).toEqual([{ inkColourId: ink.id, area: state.printArea }]);
    const result = await price(body);
    expect(result.steps.every((step) => step.instant)).toBe(true);
  });

  it("prices every part of a box of several parts, each with its own print", async () => {
    const configurator = await configuratorOf("telescope-box");
    const parts = configurator.patterns[0]!.parts;
    expect(parts.map((part) => part.name)).toEqual(["ตัวกล่อง", "ฝาบน"]);
    const base = initialState(configurator);
    const [cmyk, black] = groupsOf(configurator).find((group) => group.kind === "print_front")!.options;
    const alike = { ...base, choices: { ...base.choices, print_front: [cmyk!.id] } };
    expect(readyToPrice(configurator, alike)).toBe(true);
    // Printed alike: both parts, both printed.
    const together = buildConfiguration(configurator, alike) as Schemas["CorrugateConfigurationDto"];
    expect(
      together.parts.map((part) => [part.subPatternId, (part.printFront ?? []).map((ink) => ink.inkColourId)]),
    ).toEqual([
      [parts[0]!.subPatternId, [cmyk!.id]],
      [parts[1]!.subPatternId, [cmyk!.id]],
    ]);
    // The lid printed in one colour and the body left blank — each part as chosen.
    const apart: ConfiguratorState = {
      ...alike,
      partPrints: {
        [parts[0]!.subPatternId]: { print_front: [], print_back: [] },
        [parts[1]!.subPatternId]: { print_front: [black!.id], print_back: [] },
      },
    };
    const separate = buildConfiguration(configurator, apart) as Schemas["CorrugateConfigurationDto"];
    expect(separate.parts.map((part) => (part.printFront ?? []).map((ink) => ink.inkColourId))).toEqual([
      [],
      [black!.id],
    ]);
    const [both, lidOnly] = await Promise.all([
      price(buildCalculateBody(configurator, alike)),
      price(buildCalculateBody(configurator, apart)),
    ]);
    expect(both.steps.every((step) => step.instant)).toBe(true);
    expect(Number(lidOnly.steps[0]!.unitPrice)).toBeLessThan(Number(both.steps[0]!.unitPrice));
    // Reopened, each part keeps its print; printed alike, nothing per part is kept.
    expect(initialState(configurator, seedFromConfiguration(configurator, separate as never)).partPrints).toEqual(
      apart.partPrints,
    );
    expect(initialState(configurator, seedFromConfiguration(configurator, together as never)).partPrints).toEqual({});
  });

  it("is the published label, and the published pouch with its gusset", async () => {
    const label = await configuratorOf("product-label");
    const labelState = custom(initialState(label), { w: 60, l: 40 }, "product");
    const labelBody = buildCalculateBody(label, labelState);
    expect(labelBody.configuration).toMatchObject({
      catalogProductId: label.catalogProductId,
      w: 60,
      l: 40,
      basis: "product",
    });
    expect("parts" in labelBody.configuration).toBe(false);
    expect((await price(labelBody)).steps.every((step) => step.instant)).toBe(true);

    const pouch = await configuratorOf("stand-up-pouch");
    expect(pouch.patterns[0]!.pouch?.needs).toEqual(["b"]);
    const pouchState = custom(initialState(pouch), { w: 140, l: 200, b: 60 }, "product");
    expect(readyToPrice(pouch, pouchState)).toBe(true);
    const pouchBody = buildCalculateBody(pouch, pouchState);
    expect(pouchBody.configuration).toMatchObject({ w: 140, l: 200, b: 60, patternId: pouch.patterns[0]!.id });
    expect((await price(pouchBody)).steps.every((step) => step.instant)).toBe(true);
    // A pouch's gusset has the API's limits too.
    expect(sizeProblems(pouch, { ...pouchState, dims: { ...pouchState.dims, b: 500 } }).b).toMatchObject({
      code: "max",
    });
  });

  it("routes a size the factory cannot price to RFQ, explained, rather than failing", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = custom(initialState(configurator), { l: 480, w: 200, d: 100 }, "internal");
    const result = await price(buildCalculateBody(configurator, state));
    expect(result.steps[0]).toMatchObject({ instant: false, reason: "no_price_path", grossAmount: null });
  });

  it("reopens a saved configuration where it was left, on the basis it was entered", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const start = initialState(configurator);
    const material = groupsOf(configurator)
      .find((group) => group.kind === "material")!
      .options.at(-1)!.id;
    const changed = {
      ...custom(start, { l: 180, w: 120, d: 60 }, "external"),
      choices: { ...start.choices, material: [material] },
      quantities: [2000, 5000],
      quantity: 5000,
    };
    const seed = seedFromConfiguration(
      configurator,
      buildConfiguration(configurator, changed) as unknown as Record<string, unknown>,
      { quantity: 5000, target: "9.50" },
    );
    const reopened = initialState(configurator, seed);
    expect(reopened.basis).toBe("external");
    expect(reopened.dims).toMatchObject({ l: 180, w: 120, d: 60 });
    expect(reopened.choices.material).toEqual([material]);
    expect(reopened.quantities).toEqual([2000, 5000]);
    expect(reopened.quantity).toBe(5000);
    expect(reopened.target).toBe("9.50");
    // A configuration saved before D-182 carries no basis: it was priced on the inside.
    expect(seedFromConfiguration(configurator, { l: 100, w: 80, d: 40 }).basis).toBe("internal");
  });
});

describe("keeping the price", () => {
  it("saves a quotation with one option per quantity and its target, and puts that option in the cart", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = { ...initialState(configurator), postcode: "10110", target: "1.00" };
    const api = customer();
    const body = buildCalculateBody(configurator, { ...state, quantities: [state.quantity] });
    const { data: quote } = await api.POST("/v1/store/quotes", { body });
    expect(quote!.options).toHaveLength(1);
    expect(quote!.options[0]).toMatchObject({ quantity: state.quantity, shippingPending: false });
    expect(quote!.targetPricePerUnit).toBe("1.00");
    expect(quote!.options[0]!.targetGap?.meetsTarget).toBe(false);
    // No code until it is shared or its PDF is asked for (the published model).
    expect(quote!.quoteCode).toBeNull();
    expect(Date.parse(quote!.validUntil)).toBeGreaterThan(Date.now() + 14 * 24 * 3600_000);

    const { response } = await api.GET("/v1/store/cart");
    const { data: cart } = await api.POST("/v1/store/cart/items", {
      params: { header: { "If-Match": response.headers.get("etag")! } },
      body: { quoteId: quote!.id, quoteOptionId: quote!.options[0]!.id, designOption: "own_file" },
    });
    expect(cart!.items.some((item) => item.quoteId === quote!.id)).toBe(true);

    // An edit under a stale tag is refused, as the API does.
    await expect(
      api.POST("/v1/store/cart/items", {
        params: { header: { "If-Match": response.headers.get("etag")! } },
        body: { quoteId: quote!.id, quoteOptionId: quote!.options[0]!.id, designOption: "own_file" },
      }),
    ).rejects.toMatchObject({ status: 412 });
  });

  it("offers levers above the target; taking one saves a new quotation from it (D-248, D-249)", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const state = { ...initialState(configurator), quantities: [500], quantity: 500, target: "1.00" };
    const api = customer();
    const { data: quote } = await api.POST("/v1/store/quotes", { body: buildCalculateBody(configurator, state) });
    const { data: levers } = await api.GET("/v1/store/quotes/{quoteId}/levers", {
      params: { path: { quoteId: quote!.id } },
    });
    expect(levers!.status).toBe("computed");
    expect(levers!.levers.length).toBeGreaterThan(0);
    expect(levers!.levers.length).toBeLessThanOrEqual(5);
    const lever = levers!.levers[0]!;
    expect(lever.steps.some((step) => Number(step.unitPrice) < Number(quote!.options[0]!.unitPrice))).toBe(true);
    const { data: next } = await api.POST("/v1/store/quotes/{quoteId}/levers/{leverId}/actions/apply", {
      params: { path: { quoteId: quote!.id, leverId: lever.id } },
    });
    expect(next!.fromLever).toEqual({ quoteId: quote!.id, leverId: lever.id });
    expect(next!.targetPricePerUnit).toBe("1.00");
    const reopened = seedFromConfiguration(configurator, next!.configuration as Record<string, unknown>, {
      quantity: next!.options[0]!.quantity,
    });
    expect(reopened.quantity).toBe(next!.options[0]!.quantity);
    const { data: original } = await api.GET("/v1/store/quotes/{quoteId}", {
      params: { path: { quoteId: quote!.id } },
    });
    expect(original!.status).toBe("superseded");
  });

  it("sends a quotation to sales as a pre-filled RFQ (D-251)", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const api = customer();
    const { data: quote } = await api.POST("/v1/store/quotes", {
      body: buildCalculateBody(configurator, {
        ...initialState(configurator),
        quantities: [1000],
        quantity: 1000,
        target: "1.00",
      }),
    });
    const { data: routed } = await api.POST("/v1/store/quotes/{quoteId}/actions/send-to-cs", {
      params: { path: { quoteId: quote!.id } },
      body: { notes: "ขอราคาที่ 1 บาท" },
    });
    expect(routed).toMatchObject({ quoteStatus: "routed_to_rfq", rfqCode: expect.stringMatching(/^RFQ-/) });
  });

  it("will not save a quotation without a session", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    await expect(
      anonymous().POST("/v1/store/quotes", { body: buildCalculateBody(configurator, initialState(configurator)) }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("checks a promotion code without a session", async () => {
    const { data: valid } = await anonymous().POST("/v1/store/promotions/actions/check", {
      body: { code: "packio10", productTypeCode: "folding_carton" },
    });
    expect(valid).toMatchObject({ code: "PACKIO10", valid: true, offer: { benefit: { pct: "10.0000" } } });
    const { data: wrongType } = await anonymous().POST("/v1/store/promotions/actions/check", {
      body: { code: "CORRUGATE5", productTypeCode: "folding_carton" },
    });
    expect(wrongType).toMatchObject({ valid: false, reason: "not_applicable" });
  });
});

describe("drafts (D-185)", () => {
  it("keeps only what was answered, reports completeness, and shares by an expiring link", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const configuration = draftConfiguration(configurator, custom(initialState(configurator), { l: 120 }, null));
    expect(configuration).not.toHaveProperty("w");
    expect(configuration).not.toHaveProperty("basis");
    const api = customer();
    const { data: draft } = await api.POST("/v1/store/configurations", {
      body: {
        productTypeCode: configurator.productTypeCode,
        catalogProductId: configurator.catalogProductId,
        configuration,
        title: "กล่องครีม",
      },
    });
    expect(draft!.complete).toBe(false);
    expect(draft!.missingFields).toEqual(expect.arrayContaining(["basis", "w", "d"]));
    expect(draft!.completenessPct).toBeLessThan(100);

    const done = draftConfiguration(
      configurator,
      custom(initialState(configurator), { l: 120, w: 80, d: 40 }, "internal"),
    );
    const { data: updated } = await api.PATCH("/v1/store/configurations/{draftId}", {
      params: { path: { draftId: draft!.id } },
      body: { configuration: done },
    });
    expect(updated!.complete).toBe(true);

    const { data: share } = await api.POST("/v1/store/configurations/{draftId}/actions/share", {
      params: { path: { draftId: draft!.id } },
    });
    const { data: shared } = await anonymous().GET("/v1/store/shared-configurations/{token}", {
      params: { path: { token: share!.shareToken } },
    });
    expect(shared).toMatchObject({ catalogProductId: configurator.catalogProductId, completenessPct: 100 });
    expect(initialState(configurator, seedFromConfiguration(configurator, shared!.configuration)).dims).toMatchObject({
      l: 120,
      w: 80,
      d: 40,
    });
  });
});

describe("the Structure Advisor (D-235–D-240)", () => {
  it("needs the goods' weight, units and stacking; the conditions start at their middle band", () => {
    expect(loadOf(DEFAULT_LOAD)).toBeNull();
    expect(loadOf({ ...DEFAULT_LOAD, productWeightG: 500, unitsPerBox: 10, stackLayers: 4 })).toMatchObject({
      humidity: "normal",
      storage: "up_to_30_days",
      fragility: "medium",
      transportMode: "parcel_domestic",
      pallet: null,
    });
  });

  it("recommends a board with its range and alternatives; a choice acknowledges its warnings", async () => {
    const configurator = await configuratorOf("shipping-box");
    const state = custom(initialState(configurator), { l: 400, w: 300, d: 250 }, "internal");
    const anonymousId = crypto.randomUUID();
    const ask = (stackLayers: number) =>
      anonymous().POST("/v1/store/advisory/recommendations", {
        body: {
          productTypeCode: configurator.productTypeCode,
          configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
          load: loadOf({ ...DEFAULT_LOAD, productWeightG: 500, unitsPerBox: 10, stackLayers })!,
          anonymousId,
        },
      });
    const { data: advice } = await ask(4);
    expect(advice!.noticeCode).toBe("advisory.indicative");
    const recommended = advice!.options.find((option) => option.board.id === advice!.recommendedBoardId)!;
    expect(recommended.bct.low).toBeLessThan(recommended.bct.high);
    expect(recommended.bct.low).toBeGreaterThanOrEqual(advice!.requirement.requiredBctN);
    const { data: chosen } = await anonymous().POST(
      "/v1/store/advisory/recommendations/{recommendationId}/actions/choose",
      {
        params: { path: { recommendationId: advice!.id } },
        body: { materialId: recommended.board.id, acknowledgedWarnings: recommended.warnings, anonymousId },
      },
    );
    expect(chosen!.choice?.boardId).toBe(recommended.board.id);
    // A taller stack never gets a weaker requirement.
    const { data: taller } = await ask(8);
    expect(taller!.requirement.requiredBctN).toBeGreaterThan(advice!.requirement.requiredBctN);
  });
});
