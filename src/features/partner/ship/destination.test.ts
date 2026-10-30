import { describe, expect, it } from "vitest";

import { codeOf, placeOf, prefixOf, shipmentCodeOf } from "./destination";

describe("partner destination (P4-01)", () => {
  it("reads the API's code and postcode prefix", () => {
    const destination = { code: "D2", postcodePrefix: "101" };
    expect(codeOf(destination, 0)).toBe("D2");
    expect(prefixOf(destination)).toBe("101xx");
    expect(placeOf("กรุงเทพมหานคร", destination)).toBe("กรุงเทพมหานคร · 101xx");
  });

  it("falls back to the position and the old full postcode", () => {
    const destination = { postcode: "10110" };
    expect(codeOf(destination, 2)).toBe("D3");
    expect(prefixOf(destination)).toBe("101xx");
    expect(placeOf(null, {})).toBe("");
  });

  it("takes a shipment's code from its items when the destination has none", () => {
    expect(shipmentCodeOf({ destination: {}, items: [{}, { destinationCode: "D1" }] })).toBe("D1");
    expect(shipmentCodeOf({ destination: {}, items: [] })).toBeNull();
  });
});
