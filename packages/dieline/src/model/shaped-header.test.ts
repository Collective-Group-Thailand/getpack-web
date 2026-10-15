import { describe, expect, it } from "vitest";

import { checkDieline } from "../checks";
import { allFaces } from "../faces";
import { ALL_RECIPES } from "../library";
import { REFERENCE_MATERIALS } from "../materials";
import { HEADER_PROFILES, customProfile } from "../modules/feature/header";
import { buildFromRecipe, defaultsOf, presetsOf, styleFromRecipe } from "../recipes";
import type { ParamValues } from "../types";
import { collisions } from "./collide";

/**
 * Shaped display headers (`headerShape`) on a front-hinged tuck end: every preset profile and a
 * customer's own build a clean blank whose header stands on the back panel, folds with nothing
 * passing through, and a header never goes with a hang tab or an outline that leaves its box.
 */
const board = Object.values(REFERENCE_MATERIALS).find((m) => m.kind === "paperboard")!;
const recipe = ALL_RECIPES.find((r) => r.id === "te-reverse-crash")!;
const at = (values: ParamValues) => ({ ...defaultsOf(recipe), ...presetsOf(recipe)[0]?.values, ...values });
const errors = (v: ParamValues) =>
  styleFromRecipe(recipe)
    .validate(v, board)
    .filter((i) => i.severity === "error")
    .map((i) => i.code);

describe("shaped headers", () => {
  it.each([...Object.keys(HEADER_PROFILES), "custom"])("%s", (shape) => {
    const v = at({
      length: 70,
      width: 70,
      height: 70,
      headerShape: shape,
      headerShapeHeight: 45,
      headerPath: "M0 70 C10 10 30 10 40 40 C50 0 70 0 80 40 L100 70",
    });
    expect(errors(v)).toEqual([]);
    const built = buildFromRecipe(recipe, v, board);
    expect(checkDieline(built.dieline)).toEqual([]);
    const header = allFaces(built.dieline).find((f) => f.id === "header-top");
    expect(header?.kind).toBe("hanger");
    expect(collisions(built.dieline, built.hinges!)).toEqual([]);
  });

  it("refuses a header with a hang tab, and an outline that leaves its box", () => {
    expect(errors(at({ headerShape: "arch", hangHole: "euro" }))).toContain("header.with_hang");
    expect(errors(at({ headerShape: "custom", headerPath: "M10 50 L100 50" }))).toContain("header.path_invalid");
    expect(customProfile("M0 50 L50 95 L100 50")).toBeNull();
    expect(customProfile("not a path")).toBeNull();
    expect(customProfile("M0 50 L50 10 L100 50 Z")).toHaveLength(2);
  });
});
