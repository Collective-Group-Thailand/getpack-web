import { describe, expect, it } from "vitest";

import { componentsFor } from "./components-by-type";

const def = (component: string, productTypeCodes?: string[]) =>
  ({ component, ...(productTypeCodes ? { productTypeCodes } : {}) }) as unknown as {
    component: "material_prices";
    productTypeCodes?: string[];
  };

describe("componentsFor", () => {
  it("offers only the components the API says the product type reads (v0.43.4)", () => {
    const defs = [
      def("material_prices", ["folding_carton"]),
      def("board_prices", ["corrugated"]),
      def("film_prices", []),
    ];
    expect(componentsFor(defs, "folding_carton").map((d) => d.component)).toEqual(["material_prices"]);
    expect(componentsFor(defs, "pouch").map((d) => d.component)).toEqual([]);
  });

  it("falls back to its own copy only for an API that sends no productTypeCodes", () => {
    const defs = [def("board_prices"), def("material_prices")];
    expect(componentsFor(defs, "folding_carton").map((d) => d.component)).toEqual(["material_prices"]);
  });

  it("returns everything when no product type is named", () => {
    const defs = [def("material_prices", ["folding_carton"]), def("board_prices", ["corrugated"])];
    expect(componentsFor(defs, null)).toHaveLength(2);
  });
});
