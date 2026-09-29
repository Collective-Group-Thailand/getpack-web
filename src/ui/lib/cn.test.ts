import { describe, expect, it } from "vitest";

import { FONT_SIZE, RADIUS, SHADOW } from "../tokens/scale";
import { cn, SEMANTIC_SCALE_NAMES } from "./cn";

/** What tailwind-merge already understands without being told. */
const TSHIRT = /^(none|full|base|xs|sm|md|lg|\d*xl)$/;

describe("cn", () => {
  it("knows every non-t-shirt scale name in the tokens", () => {
    const missing = (keys: string[], known: string[]) => keys.filter((k) => !TSHIRT.test(k) && !known.includes(k));
    expect(missing(Object.keys(RADIUS), SEMANTIC_SCALE_NAMES.radius)).toEqual([]);
    expect(missing(Object.keys(SHADOW), SEMANTIC_SCALE_NAMES.shadow)).toEqual([]);
    expect(missing(Object.keys(FONT_SIZE), SEMANTIC_SCALE_NAMES.text)).toEqual([]);
  });

  it("keeps a semantic font size beside a text colour", () => {
    expect(cn("text-display", "text-fg")).toBe("text-display text-fg");
  });

  it("lets a later radius, shadow or size override a semantic one", () => {
    expect(cn("rounded-control", "rounded-none")).toBe("rounded-none");
    expect(cn("rounded-card", "rounded-cta")).toBe("rounded-cta");
    expect(cn("shadow-card", "shadow-overlay")).toBe("shadow-overlay");
    expect(cn("text-display", "text-sm")).toBe("text-sm");
  });
});
