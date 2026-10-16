// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStyle, SPEC_VERSION } from "@getpack/dieline";

import { handlers } from "../../../../mocks/handlers";
import type { Configurator } from "@/features/customer/configurator/model";
import { groupsOf, isProcessInk } from "@/features/customer/configurator/model";
import type { DesignContent, DesignSpec } from "@/features/designer/types";
import { createApiClient } from "@/lib/api/client";

import { studioHref } from "./paths";
import { maxSpotColours } from "./rules";
import { inksFor, stateForDesign } from "./state";
import { suggestBoxes } from "./suggest";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });

const blank: DesignContent = {
  elements: [],
  pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 },
};
const text = (fill: string) =>
  ({
    id: fill,
    type: "text",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    text: "A",
    fontFamily: "Sarabun",
    fontSize: 10,
    fontStyle: "normal",
    fill,
    align: "left",
    width: 10,
  }) as unknown as DesignContent["elements"][number];
const twoColours: DesignContent = { ...blank, elements: [text("#c0392b"), text("#1f6f78")] };

async function configurator() {
  return (
    await anonymous().GET("/v1/store/catalog/products/{slug}/configurator", {
      params: { path: { slug: "tuck-end-box" } },
    })
  ).data! as Configurator;
}

describe("the print method configures the inks (U4.2)", () => {
  it("prints nothing, the process ink, or spot inks up to Prepress's flexo limit", async () => {
    const c = await configurator();
    const inks = groupsOf(c).find((g) => g.kind === "print_front")!.options;
    const process = inks.find(isProcessInk)!;
    expect(inksFor(inks, twoColours, "none", null)).toEqual([]);
    expect(inksFor(inks, blank, "digital", null)).toEqual([process.id]);
    expect(inksFor(inks, twoColours, "offset", null)).toEqual([process.id]);
    const spots = inks.filter((ink) => !isProcessInk(ink));
    expect(inksFor(inks, twoColours, "flexo", null)).toHaveLength(Math.min(2, spots.length));
    expect(inksFor(inks, twoColours, "flexo", 1)).toHaveLength(1);
    expect(inksFor(inks, blank, null, null)).toEqual([]);
    expect(inksFor(inks, blank, "flexo", null)).toHaveLength(1);
  });

  it("puts the inks on the sides chosen, with the coating and finishes", async () => {
    const c = await configurator();
    const groups = groupsOf(c);
    const coating = groups.find((g) => g.kind === "coating_front")?.options[0];
    const spec: DesignSpec = {
      specVersion: SPEC_VERSION,
      styleId: "tuck-end",
      values: { length: 70, width: 40, height: 150 },
      material: { caliperMm: 0.45, kind: "paperboard" },
      materialId: null,
      studio: { printMethod: "digital", printSides: "inside", coatingId: coating?.id ?? null },
    };
    const state = stateForDesign(c, spec, twoColours, 500);
    expect(state.choices.print_front).toEqual([]);
    if (groups.some((g) => g.kind === "print_back")) expect(state.choices.print_back?.length).toBe(1);
    if (coating) expect(state.choices.coating_front).toEqual([coating.id]);
    const none = stateForDesign(c, { ...spec, studio: { printMethod: "none", printSides: "none" } }, twoColours, 500);
    expect(none.choices.print_front).toEqual([]);
  });

  it("reads the flexo limit from the rules only when Prepress set it", () => {
    const rule = {
      id: "spot_colour_count",
      severity: "warn",
      evaluatedOn: ["web"],
      printMethods: ["flexo"],
      materialClasses: null,
    };
    expect(maxSpotColours({ rules: [{ ...rule, thresholds: null }] } as never)).toBeNull();
    expect(maxSpotColours({ rules: [{ ...rule, thresholds: { maxColours: 3 } }] } as never)).toBe(3);
    expect(maxSpotColours({ rules: [{ ...rule, thresholds: { maxColours: "2" } }] } as never)).toBe(2);
  });
});

describe("describe your product (U4.2)", () => {
  it("suggests up to three boxes the product fits, the journey's family first, each with reasons", () => {
    const product = { length: 200, width: 150, height: 100 };
    const parcel = suggestBoxes(product, "parcel", null, "th");
    expect(parcel.length).toBeGreaterThan(0);
    expect(parcel.length).toBeLessThanOrEqual(3);
    expect(parcel[0]!.style.category).toBe("corrugated");
    for (const s of parcel) {
      expect(s.spec.values.length).toBeGreaterThan(product.length);
      expect(
        getStyle(s.spec.styleId)
          .validate(s.spec.values, s.spec.material)
          .filter((i) => i.severity === "error"),
      ).toEqual([]);
      expect(s.reasons.map((r) => r.code)).toContain("fits");
    }
    expect(suggestBoxes(product, "shelf", null, "th")[0]!.style.category).toBe("folding_carton");
    expect(suggestBoxes({ length: 5000, width: 5000, height: 5000 }, "parcel", null, "th")).toEqual([]);
  });
});

describe("studio entry points (U4.2 §1)", () => {
  it("land on the step that fits what is known", () => {
    expect(studioHref()).toBe("/studio/new?step=start");
    expect(studioHref({ product: "tuck-end-box", step: "start" })).toBe("/studio/new?product=tuck-end-box&step=start");
    expect(studioHref({ product: "p", style: "rsc", dims: { l: 1, w: 2, h: 3 } })).toBe(
      "/studio/new?product=p&style=rsc&l=1&w=2&h=3&step=design",
    );
    expect(studioHref({ designId: "abc" })).toBe("/studio/abc?step=design");
    expect(studioHref({ style: "rsc", dims: { l: 1, w: 2, h: 3 }, step: "box" })).toContain("step=box");
  });
});
