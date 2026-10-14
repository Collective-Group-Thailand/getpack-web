import { describe, expect, it } from "vitest";
import { isStyleId, variantsOf } from "@packio/dieline";
import { ALL_RECIPES, registerLibrary } from "@packio/dieline/library";

import { seedOf } from "@/features/customer/designer/seed";
import { variantRfqHref } from "@/features/customer/styles/paths";

import { studioHref } from "./paths";

/** A library recipe (not in the main entry) with several variants: a crash-lock tuck end. */
const recipe = ALL_RECIPES.find((r) => r.id === "ft-crash")!;
const windowed = variantsOf(recipe).find((v) => v.axes.window === "front_window")!;
const query = (href: string) => Object.fromEntries(new URL(href, "https://packio.test").searchParams);

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
