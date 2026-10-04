import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { buildCalculateBody, buildConfiguration, seedFromConfiguration } from "./build";
import { fromContract } from "./from-contract";
import { initialState, readyToPrice, sizeProblems, stepsOf, withTier } from "./state";

/**
 * The adapter on what packio-api v0.6.0 really answers: `GET
 * /v1/store/catalog/products/{slug}/configurator` from a local dev seed (2026-10-01), the two
 * ported calculators. Trimmed to one pattern and one standard size each, as served.
 */

const DEV_TUCK_END_BOX: Schemas["StoreConfiguratorDto"] = {
  slug: "dev-tuck-end-box",
  catalogProductId: "01a0f801-34f1-788c-aae7-6f4570a9bb7d",
  productTypeCode: "folding_carton",
  calculator: "folding",
  instant: false,
  difficultyLevelId: null,
  patterns: [
    {
      id: "01a0f801-34ee-725a-b14b-07a63f8b6edd",
      code: "DEV-RTE",
      name: "[DEV] ฝาเสียบกลับด้าน",
      styleCode: null,
      internationalName: null,
      pouch: null,
      dielineKey: null,
      parts: [],
      fluteTypeIds: [],
      rules: {
        minWMm: null,
        maxWMm: null,
        minLMm: null,
        maxLMm: null,
        minHMm: null,
        maxHMm: null,
        lengthMustExceedWidth: false,
        lengthMustExceedHeight: false,
        widthMustExceedHeight: false,
      },
      descriptionTh: null,
      descriptionEn: null,
      imageUrl: null,
    },
  ],
  standardSizes: [
    {
      id: "01a0f801-34f9-7b85-8c45-02c2fcb154c4",
      code: "S",
      name: "[DEV] 10×10×5 ซม.",
      lengthMm: 100,
      widthMm: 100,
      heightMm: 50,
    },
  ],
  optionGroups: [
    {
      kind: "material",
      options: [
        {
          descriptionTh: null,
          descriptionEn: null,
          imageUrl: null,
          swatchHex: null,
          id: "01a0f801-34e1-7bfb-bb7e-0ede39a3a9f9",
          code: "dev-art-350",
          nameTh: "[DEV] อาร์ตการ์ด 350 แกรม",
          nameEn: "[DEV] Art card 350 gsm",
          attributes: { kind: "paper", gsm: 350, micron: null, flute: null, isFoodGrade: false, coatable: false },
          isDefault: true,
        },
        {
          descriptionTh: null,
          descriptionEn: null,
          imageUrl: null,
          swatchHex: null,
          id: "01a0f801-34e6-7192-b7a9-48a3bd0c6aab",
          code: "dev-kraft-300",
          nameTh: "[DEV] คราฟท์ 300 แกรม",
          nameEn: "[DEV] Kraft 300 gsm",
          attributes: { kind: "paper", gsm: 300, micron: null, flute: null, isFoodGrade: false, coatable: false },
          isDefault: false,
        },
      ],
    },
    {
      kind: "coating",
      options: [
        {
          descriptionTh: null,
          descriptionEn: null,
          imageUrl: null,
          swatchHex: null,
          id: "01a0f801-34ea-7ae5-aa9f-97299c243177",
          code: "dev-matt",
          nameTh: "[DEV] เคลือบด้าน",
          nameEn: "[DEV] Matt lamination",
          attributes: { finishKind: "lamination", requiresAmount: false, requiresWidth: false, requiresLength: false },
          isDefault: false,
        },
      ],
    },
  ],
  printAreas: [],
  quoteValidityDays: 15,
  unit: "piece",
  quantity: { min: null, max: null, default: null, presets: [], maxTiers: 10 },
  design: { options: ["own_file", "online_designer", "hired_design"], default: "own_file" },
};

const DEV_RSC_CARTON: Schemas["StoreConfiguratorDto"] = {
  slug: "dev-rsc-carton",
  catalogProductId: "01a0f801-3696-7390-b902-2426298caf5d",
  productTypeCode: "corrugated",
  calculator: "corrugate",
  instant: false,
  difficultyLevelId: "01a0f801-3563-7351-9606-825a16f250a4",
  patterns: [
    {
      id: "01a0f801-3616-7dc7-af00-194eaf705634",
      code: "DEV-RSC",
      name: "[DEV] กล่องฝาชน",
      styleCode: null,
      internationalName: null,
      pouch: null,
      dielineKey: null,
      parts: [],
      fluteTypeIds: ["01a0f801-360d-7936-b76c-8a754f956f4d"],
      rules: {
        minWMm: 100,
        maxWMm: 800,
        minLMm: 100,
        maxLMm: 1000,
        minHMm: 50,
        maxHMm: 800,
        lengthMustExceedWidth: false,
        lengthMustExceedHeight: false,
        widthMustExceedHeight: true,
      },
      descriptionTh: null,
      descriptionEn: null,
      imageUrl: null,
    },
  ],
  standardSizes: [
    {
      id: "01a0f801-369c-7cf8-80b6-8eba7760576f",
      code: "M",
      name: "[DEV] 30×40×25 ซม.",
      lengthMm: 400,
      widthMm: 300,
      heightMm: 250,
    },
  ],
  optionGroups: [
    {
      kind: "material",
      options: [
        {
          descriptionTh: null,
          descriptionEn: null,
          imageUrl: null,
          swatchHex: null,
          id: "01a0f801-3610-7d88-800f-675737dc37c0",
          code: "dev-ka125-b",
          nameTh: "[DEV] กระดาษลัง KA125 ลอน B",
          nameEn: "[DEV] Kraft board KA125 B-flute",
          attributes: {
            kind: "corrugated_board",
            gsm: 450,
            micron: null,
            flute: "DEV-B",
            isFoodGrade: false,
            coatable: true,
          },
          isDefault: true,
        },
      ],
    },
  ],
  printAreas: ["top", "side", "top_side", "all_round"],
  quoteValidityDays: 15,
  unit: "piece",
  quantity: { min: null, max: null, default: null, presets: [], maxTiers: 10 },
  design: { options: ["own_file", "online_designer", "hired_design"], default: "own_file" },
};

const labels = { unit: (unit: Schemas["ProductUnit"]) => ({ piece: "ชิ้น" })[unit as "piece"] ?? unit };

describe("the published configurator, read into the configurator's view", () => {
  it("carries what the contract publishes for a folding carton", () => {
    const view = fromContract(DEV_TUCK_END_BOX, labels);
    expect(view).toMatchObject({
      slug: "dev-tuck-end-box",
      catalogProductId: DEV_TUCK_END_BOX.catalogProductId,
      productTypeCode: "folding_carton",
      calculator: "folding",
      instant: false,
      difficultyLevelId: null,
      unit: "ชิ้น",
      quoteValidityDays: 15,
      design: { options: ["own_file", "online_designer", "hired_design"], default: "own_file" },
      quantity: { presets: [], min: null, max: null, default: null, maxTiers: 10 },
      printAreas: [],
    });
    expect(view.size).toEqual({
      kind: "box",
      customAllowed: true,
      patterns: [
        {
          id: "01a0f801-34ee-725a-b14b-07a63f8b6edd",
          code: "DEV-RTE",
          name: "[DEV] ฝาเสียบกลับด้าน",
          dielineKey: null,
          imageUrl: null,
          descriptionTh: null,
          descriptionEn: null,
          parts: [],
          fluteTypeIds: [],
          // No limits published means no limits checked — none are made up.
          rules: {
            minLengthMm: null,
            maxLengthMm: null,
            minWidthMm: null,
            maxWidthMm: null,
            minHeightMm: null,
            maxHeightMm: null,
            minGussetMm: null,
            maxGussetMm: null,
            lengthMustExceedWidth: false,
            lengthMustExceedHeight: false,
            widthMustExceedHeight: false,
            stepMm: null,
          },
        },
      ],
      standardSizes: [
        {
          id: "01a0f801-34f9-7b85-8c45-02c2fcb154c4",
          code: "S",
          name: "[DEV] 10×10×5 ซม.",
          patternId: null,
          lengthMm: 100,
          widthMm: 100,
          heightMm: 50,
          gussetMm: null,
        },
      ],
    });
  });

  it("turns option kinds into the calculator's inputs: one material, a coating per side", () => {
    const view = fromContract(DEV_TUCK_END_BOX, labels);
    expect(view.groups.map(({ kind, step, selection, required }) => ({ kind, step, selection, required }))).toEqual([
      { kind: "material", step: "material", selection: "single", required: true },
      { kind: "coating_front", step: "finishing", selection: "single", required: false },
      { kind: "coating_back", step: "finishing", selection: "single", required: false },
    ]);
    expect(view.groups[0]!.options[0]).toEqual({
      id: "01a0f801-34e1-7bfb-bb7e-0ede39a3a9f9",
      code: "dev-art-350",
      nameTh: "[DEV] อาร์ตการ์ด 350 แกรม",
      nameEn: "[DEV] Art card 350 gsm",
      descriptionTh: null,
      descriptionEn: null,
      imageUrl: null,
      swatchHex: null,
      isDefault: true,
      attributes: { kind: "paper", gsm: 350, micron: null, flute: null, isFoodGrade: false, coatable: false },
      print: null,
      area: null,
    });
    // No ink colours, no print presets: no printing step (CONTRACT-GAP store.configurator).
    expect(stepsOf(view)).toEqual(["size", "material", "finishing", "quantity", "delivery", "design"]);
    // No mockup add-on is published (D-192).
    expect(view.mockup.options).toEqual([]);
  });

  it("reads the corrugate rules, flutes and print areas", () => {
    const view = fromContract(DEV_RSC_CARTON, labels);
    const pattern = view.size.patterns[0]!;
    expect(pattern.fluteTypeIds).toEqual(["01a0f801-360d-7936-b76c-8a754f956f4d"]);
    expect(pattern.rules).toMatchObject({
      minLengthMm: 100,
      maxLengthMm: 1000,
      minWidthMm: 100,
      maxWidthMm: 800,
      minHeightMm: 50,
      maxHeightMm: 800,
      widthMustExceedHeight: true,
    });
    expect(view.printAreas).toEqual(["top", "side", "top_side", "all_round"]);
    expect(view.difficultyLevelId).toBe("01a0f801-3563-7351-9606-825a16f250a4");

    const state = initialState(view);
    expect(state.dims).toEqual({ l: 400, w: 300, d: 250, gusset: null });
    expect(state.choices.material).toEqual(["01a0f801-3610-7d88-800f-675737dc37c0"]);
    expect(sizeProblems(view, { ...state, dims: { l: 400, w: 90, d: 250, gusset: null } })).toEqual({
      w: { code: "min", limitMm: 100 },
    });
    // A height at or over the width is refused; the calculator's exact share is the API's to check.
    expect(sizeProblems(view, { ...state, dims: { l: 400, w: 300, d: 300, gusset: null } })).toEqual({
      w: { code: "width_exceeds_height" },
    });
  });

  it("starts with no quantity where the API suggests none, and asks for no price for a product quoted on request", () => {
    const view = fromContract(DEV_TUCK_END_BOX, labels);
    const state = initialState(view);
    expect(state.quantities).toEqual([]);
    expect(state.mockupOption).toBe("none");
    // `instant: false`: the configurator routes to RFQ instead of asking for a price.
    expect(readyToPrice(view, { ...state, quantities: [1000], quantity: 1000 })).toBe(false);
    expect(readyToPrice({ ...view, instant: true }, { ...state, quantities: [1000], quantity: 1000 })).toBe(true);
    // No range published: any whole number, up to the tiers one calculation prices.
    expect(withTier(view, [], 1)).toEqual([1]);
    expect(withTier(view, [], 0)).toBeNull();
    expect(withTier(view, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 11)).toBeNull();
  });

  it("builds the published configurations from the published ids", () => {
    const folding = fromContract({ ...DEV_TUCK_END_BOX, instant: true }, labels);
    const coating = "01a0f801-34ea-7ae5-aa9f-97299c243177";
    const state = {
      ...initialState(folding),
      quantities: [1000],
      quantity: 1000,
      choices: { ...initialState(folding).choices, coating_front: [coating] },
    };
    expect(buildCalculateBody(folding, state)).toEqual({
      productTypeCode: "folding_carton",
      configuration: {
        catalogProductId: "01a0f801-34f1-788c-aae7-6f4570a9bb7d",
        patternId: "01a0f801-34ee-725a-b14b-07a63f8b6edd",
        l: 100,
        w: 100,
        d: 50,
        materialId: "01a0f801-34e1-7bfb-bb7e-0ede39a3a9f9",
        // The product has none: the real API answers `pricing.not_instant` before it looks.
        difficultyLevelId: "",
        quantities: [1000],
        // An empty `parts` is one part, sent without `subPatternId`.
        parts: [{ printFront: [], printBack: [], finish1FrontId: coating, finish2: [], assemblies: [] }],
        design: { graphic: false, structure: false },
      },
    });
    // The coating goes back to the side it was sent for.
    const seed = seedFromConfiguration(
      folding,
      buildConfiguration(folding, state) as unknown as Record<string, unknown>,
    );
    expect(seed.choices).toMatchObject({ coating_front: [coating], coating_back: [] });

    const corrugate = fromContract(DEV_RSC_CARTON, labels);
    const box = { ...initialState(corrugate), quantities: [500], quantity: 500 };
    expect(buildCalculateBody(corrugate, box).configuration).toEqual({
      catalogProductId: "01a0f801-3696-7390-b902-2426298caf5d",
      patternId: "01a0f801-3616-7dc7-af00-194eaf705634",
      l: 400,
      w: 300,
      d: 250,
      materialId: "01a0f801-3610-7d88-800f-675737dc37c0",
      difficultyLevelId: "01a0f801-3563-7351-9606-825a16f250a4",
      quantities: [500],
      parts: [{ printFront: [], printBack: [], assemblies: [] }],
      design: { graphic: false, structure: false },
    });
  });
});
