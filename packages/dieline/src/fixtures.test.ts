import { describe, expect, it } from "vitest";

import { patternFixtures } from "./fixtures";
import { STYLES } from "./styles";

const fixtures = patternFixtures();

describe("legacy pattern fixtures (for getpack-api's golden comparison)", () => {
  it("covers every mapped legacy key exactly once", () => {
    const keys = new Set(STYLES.flatMap((s) => s.legacy?.patternKeys ?? []));
    expect(new Set(fixtures.map((f) => f.patternKey))).toEqual(keys);
    expect(new Set(fixtures.map((f) => f.fileKey)).size).toBe(fixtures.length);
  });

  it.each(fixtures.map((f) => ({ f })))("$f.patternKey → $f.styleId is stable", async ({ f }) => {
    await expect(f.svg).toMatchFileSnapshot(`../fixtures/patterns/${f.fileKey}.svg`);
  });
});
