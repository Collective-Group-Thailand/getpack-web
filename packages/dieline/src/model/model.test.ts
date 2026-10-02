import { describe, expect, it } from "vitest";

import { REFERENCE_MATERIALS } from "../materials";
import { buildFromRecipe, RECIPES } from "../recipes";
import { collisions } from "./collide";
import { inflatedPouch, pouchBulge } from "./pouch";
import { foldModel, modelBounds, WRAP_MM } from "./thickness";

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const board = REFERENCE_MATERIALS["board-350"];
const t = board.caliperMm;
const face = (model: ReturnType<typeof foldModel>, id: string) => model.faces.find((f) => f.id === id)!;

describe("the thickness model", () => {
  const built = buildFromRecipe(recipe("tuck-end"), { length: 70, width: 40, height: 150 }, board);
  const model = foldModel(built.dieline, built.hinges!, board);

  it("centres walls on their crease plane", () => {
    expect(face(model, "front")).toMatchObject({ lo: -t / 2, hi: t / 2 });
  });

  it("lays closures inward of their plane, the last to close outermost", () => {
    expect(face(model, "lid-top")).toMatchObject({ lo: -t, hi: 0 });
    const dust = face(model, "dust-right-top");
    expect(dust.lo).toBeCloseTo(-2 * t, 9);
    expect(dust.hi).toBeCloseTo(-t, 9);
  });

  it("puts a tuck behind the panel it slides down", () => {
    const tuck = face(model, "tuck-top");
    expect(tuck.hi).toBeLessThanOrEqual(-t / 2 + 1e-9);
  });

  it("stacks rolled inner walls inside their wall, whichever way their print faces", () => {
    const tray = buildFromRecipe(recipe("double-wall-tray"), {}, board);
    const m = foldModel(tray.dieline, tray.hinges!, board);
    const b = modelBounds(tray.dieline, m);
    const sizes = [0, 1, 2].map((i) => b.max[i] - b.min[i]).sort((p, q) => p - q);
    expect(sizes[2]).toBeCloseTo(250 + 2 * t, 6);
  });

  it("lies flat, every slab centred, before it folds", () => {
    const flat = foldModel(built.dieline, built.hinges!, board, 0);
    for (const f of flat.faces) {
      expect(f.lo, f.id).toBeCloseTo(-t / 2, 9);
      expect(f.hi, f.id).toBeCloseTo(t / 2, 9);
    }
  });

  it("wraps rigid board in paper on its outer face", () => {
    const rigid = REFERENCE_MATERIALS["rigid-2"];
    const tele = buildFromRecipe(recipe("telescope"), {}, rigid);
    const m = foldModel(tele.dieline, tele.hinges!, rigid);
    const wall = m.faces.find((f) => f.kind === "wall")!;
    expect(wall.hi - wall.lo).toBeCloseTo(rigid.caliperMm + WRAP_MM, 9);
  });
});

describe("collisions", () => {
  it("finds none in a box that closes", () => {
    const built = buildFromRecipe(recipe("tuck-end"), {}, board);
    expect(collisions(built.dieline, built.hinges!)).toEqual([]);
  });

  it("finds faces passing through each other in a box that is folded wrong", () => {
    const built = buildFromRecipe(recipe("tuck-end"), {}, board);
    // A side panel folded to 130° instead of 90° swings the back panel through the front.
    const wrong = { ...built.hinges!, angles: { ...built.hinges!.angles, right: 130 } };
    expect(collisions(built.dieline, wrong)).toContainEqual(["front", "back"]);
  });
});

describe("an inflated pouch", () => {
  it("keeps its flat size and bulges both webs by the same amount, seals flat", () => {
    const v = { pouchType: "standing", width: 140, length: 200, bottom: 40, sealWidth: 8 };
    const mesh = inflatedPouch(v);
    const xs = mesh.positions.map((p) => p[0]);
    const ys = mesh.positions.map((p) => p[1]);
    const zs = mesh.positions.map((p) => p[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(140, 9);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(200, 9);
    expect(Math.max(...zs)).toBeCloseTo(pouchBulge(v), 6);
    expect(Math.min(...zs)).toBeCloseTo(-pouchBulge(v), 6);
    const edge = mesh.positions.filter((p) => Math.abs(Math.abs(p[0]) - 70) < 1e-9);
    expect(edge.every((p) => Math.abs(p[2]) < 1e-9)).toBe(true);
    expect(mesh.triangles).toHaveLength(2 * 2 * 16 * 16);
  });
});
