import { describe, expect, it } from "vitest";
import { defaultsOf, getStyle, isStyleId, presetsOf, variantsOf } from "@getpack/dieline";
import { ALL_RECIPES, registerLibrary } from "@getpack/dieline/library";

import { seedOf } from "@/features/customer/designer/seed";
import { variantRfqHref } from "@/features/customer/styles/paths";

import { studioHref } from "./paths";

/** A library recipe (not in the main entry) with several variants: a crash-lock tuck end. */
const recipe = ALL_RECIPES.find((r) => r.id === "ft-crash")!;
const windowed = variantsOf(recipe).find((v) => v.axes.window === "front_window")!;
const query = (href: string) => Object.fromEntries(new URL(href, "https://getpack.test").searchParams);

describe("a style page's variant in the studio (D-407)", () => {
  it("names the base, the variant and the engine variant in the link", () => {
    const href = studioHref({
      product: "tuck-end-box",
      style: recipe.id,
      dims: { l: 80, w: 50, h: 120 },
      variant: { base: "PK-FT-01", code: "PK-FT-01-AB12", key: windowed.key },
      step: "box",
    });
    expect(query(href)).toMatchObject({
      style: "ft-crash",
      base: "PK-FT-01",
      sv: "PK-FT-01-AB12",
      rv: windowed.key,
      step: "box",
    });
  });

  it("seeds the variant's shape and code once the library is registered", () => {
    expect(isStyleId("ft-crash")).toBe(false);
    registerLibrary();
    const href = studioHref({
      style: recipe.id,
      dims: { l: 80, w: 50, h: 120 },
      variant: { base: "PK-FT-01", code: "PK-FT-01-AB12", key: windowed.key },
    });
    const seed = seedOf(query(href), ALL_RECIPES)!;
    expect(seed.style).toBe("ft-crash");
    expect(seed.dims).toEqual({ length: 80, width: 50, height: 120 });
    expect(seed.values).toMatchObject({ window: "rect", windowPanel: "front" });
    expect(seed.variant).toEqual({ baseCode: "PK-FT-01", styleVariantCode: "PK-FT-01-AB12" });
  });

  it("ignores an unknown engine variant or a malformed code — the box still opens, as the plain style", () => {
    registerLibrary();
    const base = { style: "ft-crash", l: "80", w: "50", h: "120", base: "PK-FT-01" };
    const unknown = seedOf({ ...base, sv: "PK-FT-01-AB12", rv: "window=skylight" }, ALL_RECIPES)!;
    expect(unknown.variant).toBeUndefined();
    expect(unknown.values).toBeUndefined();
    const malformed = seedOf({ ...base, sv: "<script>", rv: windowed.key }, ALL_RECIPES)!;
    expect(malformed.variant).toBeUndefined();
  });
});

describe("every style opens in the studio (C7, DECISIONS-STAGE-A §2)", () => {
  it("seeds every variant of every library recipe — boxes on their size, the rest (bags, cups, labels) on their values", () => {
    registerLibrary();
    const failures: string[] = [];
    for (const r of ALL_RECIPES) {
      for (const v of variantsOf(r)) {
        const values = { ...defaultsOf(r), ...presetsOf(r)[0]?.values, ...v.values };
        const [l, w, h] = [values.length, values.width, values.height];
        const boxed = typeof l === "number" && typeof w === "number" && typeof h === "number";
        const href = studioHref({
          style: r.id,
          dims: boxed ? { l, w, h } : null,
          variant: { base: r.base ?? "PK-XX-01", code: "PK-XX-01-AB12", key: v.key },
        });
        const seed = seedOf(query(href), ALL_RECIPES);
        if (!seed || !seed.values) failures.push(`${r.id} ${v.key}`);
        else if (getStyle(seed.style).params.length === 0) failures.push(`${r.id} has no params`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("opens a paper bag (width × gusset × height) without box dims, on its own values", () => {
    registerLibrary();
    const bag = ALL_RECIPES.find((r) => r.id === "paper-bag")!;
    const v = variantsOf(bag)[0]!;
    const href = studioHref({ style: bag.id, variant: { base: "PK-PG-01", code: "PK-PG-01-AB12", key: v.key } });
    expect(query(href)).toMatchObject({ style: "paper-bag", step: "design" });
    expect(query(href).l).toBeUndefined();
    const seed = seedOf(query(href), ALL_RECIPES)!;
    expect(seed.dims).toBeUndefined();
    expect(seed.values).toMatchObject({
      width: expect.any(Number),
      gusset: expect.any(Number),
      height: expect.any(Number),
    });
  });

  it("still needs a size or a variant: a bare style opens nothing", () => {
    expect(seedOf({ style: "rsc" })).toBeUndefined();
  });
});

describe("a style page's variant in a quotation request (D-407)", () => {
  it("adds the base and the variant to the product type's form", () => {
    expect(variantRfqHref("/rfq/boxes?type=folding_carton", "PK-FT-01", "PK-FT-01-AB12")).toBe(
      "/rfq/boxes?type=folding_carton&base=PK-FT-01&style=PK-FT-01-AB12",
    );
    expect(variantRfqHref("/rfq/boxes", "PK-FT-01", "PK-FT-01-AB12")).toBe(
      "/rfq/boxes?base=PK-FT-01&style=PK-FT-01-AB12",
    );
    expect(variantRfqHref(null, "PK-FT-01", "PK-FT-01-AB12")).toBe("/contact");
  });
});
