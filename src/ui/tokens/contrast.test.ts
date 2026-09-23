import { describe, expect, it } from "vitest";

import { checkContrast, checkDecorative, PAIRS, uncheckedKeys } from "../../../scripts/check-contrast";
import { THEME_NAMES } from "./semantic";

/**
 * The contrast gate ADR-0003 promises runs here, so it is part of `pnpm test` rather than a
 * step somebody can forget. axe cannot do this job: jsdom has no colour, and the palette is
 * authored in OKLCH, which needs gamut mapping before a ratio means anything.
 */
describe("semantic token contrast (WCAG 2.2 AA)", () => {
  const results = checkContrast();

  it("checks every pair in every theme", () => {
    expect(results).toHaveLength(PAIRS.length * THEME_NAMES.length);
  });

  it.each(results.map((r) => [`${r.theme}: ${r.fg} on ${r.bg} (${r.why})`, r] as const))("%s", (_name, result) => {
    expect(
      result.ratio,
      `${result.fg} on ${result.bg} in the ${result.theme} theme is ${result.ratio.toFixed(2)}:1, ` +
        `below the ${result.min}:1 this pair needs (${result.why}). ` +
        `Fix src/ui/tokens/semantic.ts, then run pnpm tokens.`,
    ).toBeGreaterThanOrEqual(result.min - 0.005);
  });

  it.each(checkDecorative().map((r) => [`${r.theme}: ${r.fg} on ${r.bg} (${r.why})`, r] as const))(
    "%s stays within its decorative range",
    (_name, result) => {
      expect(result.ratio).toBeGreaterThanOrEqual(result.min);
      expect(result.ratio).toBeLessThanOrEqual(result.max);
    },
  );

  it("leaves no semantic colour unchecked", () => {
    expect(uncheckedKeys()).toEqual([]);
  });
});
