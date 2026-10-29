import { describe, expect, it } from "vitest";

import { evaluateDocumentLikeTheApi } from "../../../../mocks/store/studio";
import type { DesignElement } from "../types";
import { documentInks, spotColours } from "./checks";

/** C8-1 (D-459): hidden elements, gradients and one-ink images counted as getpack-api counts them. */
describe("documentInks (C11, D-459)", () => {
  const el = (over: Record<string, unknown>) =>
    ({ id: "x", type: "rect", fill: "#000000", ...over }) as unknown as DesignElement;

  it("skips hidden elements", () => {
    expect(documentInks([el({}), el({ fill: "#ff0000", hidden: true })]).colours).toEqual(new Set(["#000000"]));
  });

  it("counts a gradient's ends and needs process printing", () => {
    expect(documentInks([el({ fillGradient: { from: "#FF0000", to: "#0000ff" } })])).toEqual({
      colours: new Set(["#ff0000", "#0000ff"]),
      process: true,
    });
  });

  it("counts a one-ink image as one ink; a colour image needs process", () => {
    expect(documentInks([el({ type: "image", mono: true }), el({})])).toEqual({
      colours: new Set(["mono-image", "#000000"]),
      process: false,
    });
    expect(documentInks([el({ type: "image" })]).process).toBe(true);
  });

  it("leaves an open path's fill and a stroke of width 0 unprinted; a solid background is one colour", () => {
    expect(
      spotColours(
        [
          el({ type: "shape", open: true, fill: "#ff0000", stroke: "#00ff00", strokeWidth: 1 }),
          el({ fill: "#0000ff", stroke: "#123456", strokeWidth: 0 }),
        ],
        { kind: "solid", color: "#eeeeee", background: "#ffffff" } as never,
      ),
    ).toEqual(new Set(["#00ff00", "#0000ff", "#eeeeee"]));
  });

  it("matches the API's evaluator (mock port) on the same document", () => {
    const rules = [
      {
        id: "spot_colour_count",
        severity: "warn",
        evaluatedOn: ["document", "web"],
        printMethods: ["flexo"],
        materialClasses: null,
        thresholds: { maxColours: 2 },
      },
    ];
    const elements = [
      el({ fillGradient: { from: "#ff0000", to: "#00ff00" } }),
      el({ id: "h", fill: "#0000ff", hidden: true }),
    ];
    const found = evaluateDocumentLikeTheApi({ content: { elements, pattern: { kind: "none" } } }, rules as never, {
      undeclared: new Set(),
    });
    expect(found).toEqual([
      { ruleId: "spot_colour_count", severity: "warn", elementId: "", details: { colours: 2, max: 2, process: true } },
    ]);
    expect(documentInks(elements)).toEqual({ colours: new Set(["#ff0000", "#00ff00"]), process: true });
  });
});
