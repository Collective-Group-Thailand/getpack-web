import { describe, expect, it } from "vitest";

import { checkDieline } from "../checks";
import { callsOf } from "../expr";
import { LAYER_OF } from "../export/layers";
import { allFaces } from "../faces";
import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "../materials";
import { MODULES, PROCESSES } from "../modules";
import { ALL_RECIPES as RECIPES, registerLibrary } from "../library";

registerLibrary();
import { getStyle, hingeMapOf, resolveValues, STYLES } from "../styles";
import { EXPRESSION_FUNCTIONS } from "./context";
import {
  AXIS_PHRASES,
  buildFromRecipe,
  collectExpressions,
  describeVariant,
  parseRecipe,
  presetsOf,
  RECIPES as CORE,
  RecipeError,
  variantsOf,
  type StyleRecipe,
} from ".";

const tuckEnd = RECIPES.find((r) => r.id === "tuck-end")!;
const clone = (r: StyleRecipe): StyleRecipe => JSON.parse(JSON.stringify(r)) as StyleRecipe;
const rejects = (mutate: (r: StyleRecipe) => void, code: string) => {
  const r = clone(tuckEnd);
  mutate(r);
  try {
    parseRecipe(r);
  } catch (e) {
    expect(e).toBeInstanceOf(RecipeError);
    expect((e as RecipeError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
};

describe("recipes", () => {
  it("all pass parseRecipe (the package does not re-check them at load)", () => {
    for (const r of RECIPES) expect(parseRecipe(JSON.parse(JSON.stringify(r))), r.id).toBeTruthy();
  });

  it("are the registry: one recipe per style, in the same order", () => {
    expect(CORE.map((r) => r.id)).toEqual(STYLES.map((s) => s.id));
  });

  it("build exactly what the style builds, and fold the same way", () => {
    for (const r of RECIPES) {
      const style = getStyle(r.id);
      const m = REFERENCE_MATERIALS[REFERENCE_BY_CATEGORY[r.category][0]];
      const values = resolveValues(style, presetsOf(r)[0].values);
      const built = buildFromRecipe(r, presetsOf(r)[0].values, m);
      expect(built.dieline, r.id).toEqual(style.build(values, m));
      expect(built.hinges, r.id).toEqual(hingeMapOf(style, values, m));
      expect(checkDieline(built.dieline), r.id).toEqual([]);
      for (const [key, limit] of Object.entries(built.limits)) {
        const p = style.params.find((q) => q.key === key)!;
        expect(limit, `${r.id}.${key}`).toEqual({ min: p.min, max: p.max });
      }
    }
  });

  it("hold only expressions that compile, with known functions", () => {
    const all = RECIPES.flatMap((r) => collectExpressions(r));
    expect(all.length).toBeGreaterThan(100);
    for (const src of all) for (const f of callsOf(src)) expect(EXPRESSION_FUNCTIONS, src).toContain(f);
  });

  it("name a master-file base code where one is mapped, and a closed-size rule for shapes that are not boxes", () => {
    for (const r of RECIPES) if (r.base) expect(r.base, r.id).toMatch(/^PK-[A-Z]{2}-\d{2}$/);
    for (const id of ["gable", "hexagonal", "pillow", "telescope", "sleeve-drawer"])
      expect(RECIPES.find((r) => r.id === id)!.closedSize, id).toBeDefined();
  });

  it("are refused when they are broken, with a machine-readable code", () => {
    rejects((r) => ((r as { schemaVersion: number }).schemaVersion = 2), "recipe.schema_version");
    rejects((r) => (r.body = { module: "nope" }), "recipe.unknown_module");
    rejects((r) => (r.body = { module: "tuck" }), "recipe.wrong_slot");
    rejects((r) => (r.body = { module: "tube", preset: "nope" }), "recipe.unknown_preset");
    rejects((r) => (r.closures!.top = { module: "hingedLid" }), "recipe.does_not_fit");
    rejects((r) => (r.params = [...r.params, "nope"]), "recipe.unknown_param");
    rejects((r) => (r.params = [...r.params, "grain"]), "recipe.duplicate_param");
    rejects((r) => (r.body!.with = { depth: "height +" }), "recipe.bad_expression");
    rejects((r) => (r.body!.with = { depth: "cube(height)" }), "recipe.unknown_function");
    rejects((r) => (r.body!.with = { piece: { id: "x", label: "carton" } }), "recipe.unknown_label");
    rejects((r) => (r.pieceSet = { module: "lidAndBase" }), "recipe.body_or_piece_set");
    rejects(
      (r) => (r.incompatible = [{ modules: ["tube", "tuck"], code: "recipe.tuck_on_tube" }]),
      "recipe.tuck_on_tube",
    );
    rejects(
      (r) =>
        (r.constraints = [{ id: "x", code: "x", severity: "error", require: "1 <", message: { th: "x", en: "x" } }]),
      "recipe.bad_expression",
    );
  });
});

describe("modules", () => {
  it("have unique ids, words in both languages and the processes a factory needs", () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      expect(m.label.th && m.label.en, m.id).toBeTruthy();
      expect(m.processes.length, m.id).toBeGreaterThan(0);
      for (const p of m.processes) expect(PROCESSES, m.id).toContain(p);
      for (const role of m.contributes.roles) expect(LAYER_OF[role], `${m.id}.${role}`).toBeDefined();
    }
  });

  it("are all used by a recipe when implemented, and refuse to build while planned", () => {
    const used = new Set(
      RECIPES.flatMap((r) =>
        [r.body, r.pieceSet, r.closures?.top, r.closures?.bottom, ...(r.features ?? [])].map((u) => u?.module),
      ),
    );
    for (const m of MODULES.filter((x) => x.status === "implemented")) expect(used.has(m.id), m.id).toBe(true);
    const planned = MODULES.filter((x) => x.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    const r = clone(tuckEnd);
    const still = planned.find((x) => x.slot === "feature" && x.fits.includes("tube"))!;
    r.features = [...(r.features ?? []), { module: still.id }];
    expect(() => buildFromRecipe(r, presetsOf(r)[0].values, REFERENCE_MATERIALS["board-350"])).toThrow(
      new RegExp(`module\\.not_implemented: ${still.id}`),
    );
  });

  it("contribute faces of the kinds they declare", () => {
    const declared = new Map(MODULES.map((m) => [m.id, new Set(m.contributes.kinds)]));
    for (const r of RECIPES) {
      const m = REFERENCE_MATERIALS[REFERENCE_BY_CATEGORY[r.category][0]];
      const kinds = new Set(allFaces(buildFromRecipe(r, presetsOf(r)[0].values, m).dieline).map((f) => f.kind));
      const allowed = new Set(
        [r.body, r.pieceSet, r.closures?.top, r.closures?.bottom, ...(r.features ?? [])]
          .filter(Boolean)
          .flatMap((u) => [...(declared.get(u!.module) ?? [])]),
      );
      for (const k of kinds) expect(allowed, `${r.id}: ${k}`).toContain(k);
    }
  });
});

describe("variants and their words", () => {
  /** Claims and sales wording a generated name must never carry (D-181, D-208). */
  const CLAIMS =
    /\b(best|premium|luxury|eco|green|sustainable|cheapest|perfect|ultimate|no\.?\s?1)\b|ดีที่สุด|พรีเมียม|หรูหรา|รักษ์โลก|ถูกที่สุด|อันดับ\s?1/i;

  it("are every combination of a recipe's axes, each with a unique key", () => {
    for (const r of RECIPES) {
      const variants = variantsOf(r);
      const expected = Object.values(r.variants ?? {}).reduce((n, o) => n * Object.keys(o).length, 1);
      expect(variants, r.id).toHaveLength(expected);
      expect(new Set(variants.map((v) => v.key)).size, r.id).toBe(variants.length);
      for (const v of variants)
        for (const [axis, value] of Object.entries(r.variant ?? {})) expect(v.axes[axis]).toBe(value);
    }
  });

  it("have generated Thai and English names that describe, never sell, pending review", () => {
    for (const r of RECIPES)
      for (const v of variantsOf(r)) {
        const words = describeVariant(r, v);
        for (const text of [words.name.th, words.name.en, words.description.th, words.description.en]) {
          expect(text.length, `${r.id} ${v.key}`).toBeGreaterThan(3);
          expect(text, `${r.id} ${v.key}`).not.toMatch(CLAIMS);
        }
        expect(words.reviewStatus).toBe("pending");
      }
  });

  it("name every axis value a recipe uses", () => {
    for (const r of RECIPES)
      for (const [axis, options] of Object.entries(r.variants ?? {}))
        for (const value of Object.keys(options)) expect(AXIS_PHRASES[axis], `${axis}`).toHaveProperty(value);
  });
});
