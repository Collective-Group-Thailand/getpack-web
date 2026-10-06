import { describe, expect, it } from "vitest";

import { specLines } from "./spec";

const format = (n: number) => String(n);

describe("specLines (round 1, partner job spec)", () => {
  it("reads the snapshot as style, sizes, caliper, print and design — no ids, no JSON", () => {
    const lines = specLines(
      {
        style: { code: "DEV-RSC", name: "กล่องฝาชน (RSC)" },
        dimensions: {
          caliperMm: 3.3,
          sizes: { internal: { l: 200, w: 150, d: 80 }, external: { l: 206.6, w: 156.6, d: 86.6 }, product: null },
        },
        designOption: "own_file",
        configuration: { parts: [{ printFront: [{ area: "top", inkColourId: "01a1…" }] }], patternId: "01a1…" },
      },
      format,
    );
    expect(lines).toEqual([
      { key: "style", values: { name: "กล่องฝาชน (RSC) · DEV-RSC" } },
      { key: "internal", values: { size: "200 × 150 × 80" } },
      { key: "external", values: { size: "206.6 × 156.6 × 86.6" } },
      { key: "caliper", values: { mm: "3.3" } },
      { key: "print", values: { count: "1" } },
      { key: "design.own_file" },
    ]);
    expect(JSON.stringify(lines)).not.toContain("01a1");
  });

  it("leaves out what the snapshot does not have", () => {
    expect(specLines({ unit: "set" }, format)).toEqual([]);
    expect(specLines(null, format)).toEqual([]);
  });
});
