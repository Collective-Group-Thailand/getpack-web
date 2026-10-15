import { describe, expect, it } from "vitest";

import { checkDieline } from "../checks";
import { allFaces } from "../faces";
import { ALL_RECIPES } from "../library";
import { REFERENCE_MATERIALS } from "../materials";
import { buildFromRecipe, defaultsOf, presetsOf, styleFromRecipe } from "../recipes";
import type { ParamValues } from "../types";
import { collisions } from "./collide";

/**
 * Inserts cut to the product (`cavityShape`, `cavityGrid`, `cavityLength`, `cavityWidth`): the
 * five-bottle carrier's cradle, a cream jar's collar, a grid of rectangles — on a tray, a tuck end
 * and a double-wall carton. Each builds a clean blank and folds with nothing passing through; a
 * product too large for its cell is refused, never cut over the platform's edge.
 */
const board = Object.values(REFERENCE_MATERIALS).find((m) => m.kind === "paperboard")!;
const recipe = (id: string) => ALL_RECIPES.find((r) => r.id === id)!;
const at = (id: string, values: ParamValues) => ({ ...defaultsOf(recipe(id)), ...presetsOf(recipe(id))[0]?.values, ...values });
const errors = (id: string, v: ParamValues) =>
  styleFromRecipe(recipe(id))
    .validate(v, board)
    .filter((i) => i.severity === "error")
    .map((i) => i.code);
const cavities = (id: string, v: ParamValues) =>
  allFaces(buildFromRecipe(recipe(id), v, board).dieline).find((f) => f.id === "insert-platform")?.holes ?? [];

const cases: [string, string, ParamValues, number][] = [
  [
    "five bottles lying in a hinged-lid tray",
    "tray-lid-lock",
    { length: 200, width: 150, height: 40, insert: "die_cut", cavityShape: "bottle", cavityGrid: "1x5", cavityLength: 120, cavityWidth: 25 },
    5,
  ],
  [
    "a cream jar in a reverse tuck end",
    "te-reverse-crash",
    { length: 70, width: 70, height: 70, insert: "die_cut", cavityShape: "circle", cavityGrid: "1x1", cavityLength: 50 },
    1,
  ],
  [
    "six rectangles in a double-wall carton",
    "te3-double-wall",
    { length: 250, width: 180, height: 80, insert: "die_cut", cavityShape: "rect", cavityGrid: "2x3", cavityLength: 60, cavityWidth: 60 },
    6,
  ],
];

describe("cavity inserts", () => {
  it.each(cases)("%s", (_name, id, values, count) => {
    const v = at(id, values);
    expect(errors(id, v)).toEqual([]);
    const built = buildFromRecipe(recipe(id), v, board);
    expect(checkDieline(built.dieline)).toEqual([]);
    expect(cavities(id, v)).toHaveLength(count);
    expect(collisions(built.dieline, built.hinges!)).toEqual([]);
  });

  it("refuses a product larger than its cell and cuts nothing", () => {
    const v = at("tray-lid-lock", {
      length: 200,
      width: 150,
      height: 40,
      insert: "die_cut",
      cavityShape: "circle",
      cavityGrid: "1x5",
      cavityLength: 60,
    });
    expect(errors("tray-lid-lock", v)).toContain("insert.cavity_too_big");
    expect(cavities("tray-lid-lock", v)).toEqual([]);
  });

  it("keeps the standard cavity when no product is given", () => {
    const v = at("tray-lid-lock", { insert: "die_cut" });
    expect(cavities("tray-lid-lock", v)).toHaveLength(1);
  });
});
