// @vitest-environment node
import { describe, expect, it } from "vitest";

import { styleDieline } from "./style-dielines.server";

/** The bases UAT publishes (packio-api `pnpm uat:styles`): every one the engine has a recipe for. */
const PUBLISHED = ["PK-CF-01", "PK-CS-01", "PK-CS-02", "PK-LB-01", "PK-SL-01", "PK-TE-01", "PK-TG-01", "PK-TR-01"];

describe("a template card's dieline (visual review, item 1)", () => {
  it("is each style's own, drawn from its recipe — never one shared picture", () => {
    const cards = PUBLISHED.map((code) => styleDieline(code, "card"));
    for (const [i, card] of cards.entries()) {
      expect(card, PUBLISHED[i]).not.toBeNull();
      expect(card!.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      // The engine's cut layer, with paths in it.
      expect(decodeURIComponent(card!.src)).toMatch(/<g id="CUT"[^>]*><path d="M/);
      expect(card!.aspect).toBeGreaterThan(0);
    }
    expect(new Set(cards.map((card) => card!.src)).size).toBe(cards.length);
  });

  it("draws the thumbnail heavier than the card, and nothing for a base the engine has no recipe for", () => {
    const stroke = (src: string) => Number(/stroke-width="([\d.]+)"/.exec(decodeURIComponent(src))![1]);
    expect(stroke(styleDieline("PK-TE-01", "thumb")!.src)).toBeGreaterThan(
      stroke(styleDieline("PK-TE-01", "card")!.src),
    );
    expect(styleDieline("PK-ZZ-99", "card")).toBeNull();
    expect(styleDieline("PK-ZZ-99", "thumb")).toBeNull();
  });
});
