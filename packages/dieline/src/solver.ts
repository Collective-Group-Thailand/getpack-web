import { compile, evaluate, namesOf } from "./expr";
import { isActive, schemaIssues, withDefaults } from "./params";
import { drawRecipe, recipeConstraints, recipeContext, recipeUses } from "./recipes/build";
import { defaultsOf, presetsOf, resolveParam } from "./recipes/params";
import type { StyleRecipe } from "./recipes/types";
import { dielineManufacturing } from "./rules/manufacturing";
import { materialRules } from "./rules/materials";
import { MODULE_MANUFACTURING } from "./rules/module-rules";
import { materialIssues } from "./styles/_shared";
import type { Dieline, Issue, MaterialSpec, ParamSchema, ParamValues } from "./types";

/**
 * The constraint solver (U3.2): why a size fails (`explain`) and which sizes pass (`validRanges`).
 * It reads the same rules `validate()` runs, plus the material class's manufacturing rules, so a
 * range the UI shows and the rule that rejects a size never disagree.
 */

export type ViolationRule = "schema" | "material" | "constraint" | "geometry" | "manufacturing";

/** A rule a size breaks, as codes and numbers — the UI translates `code` (the message is a fallback). */
export interface Violation {
  code: string;
  severity: "error" | "warning";
  rule: ViolationRule;
  /** The constraint id, for data rules. */
  constraintId?: string;
  /** The parameter to change. */
  param?: string;
  /** Every parameter the rule reads. */
  params: string[];
  /** The limit the value had to respect, when the rule is a plain comparison. */
  expected?: { min?: number; max?: number };
  actual?: number;
  message: Issue["message"];
}

const paramsCache = new WeakMap<StyleRecipe, ParamSchema[]>();
function paramsOf(recipe: StyleRecipe): ParamSchema[] {
  let p = paramsCache.get(recipe);
  if (!p) paramsCache.set(recipe, (p = recipe.params.map((x) => resolveParam(x))));
  return p;
}

const dimsOf = (recipe: StyleRecipe) => (recipeUses(recipe).main.cfg.dims ?? {}) as Record<string, string>;

/** The parameters an expression reads, following the body's named sizes back to theirs (`depth` → `height`). */
function paramsRead(src: string, keys: Set<string>, dims: Record<string, string>, seen = new Set<string>()): string[] {
  return namesOf(src).flatMap((n) => {
    if (n in dims && !seen.has(n)) {
      seen.add(n);
      return paramsRead(dims[n], keys, dims, seen).concat(keys.has(n) ? [n] : []);
    }
    return keys.has(n) ? [n] : [];
  });
}

const fromIssue = (i: Issue, rule: ViolationRule): Violation => ({
  code: i.code,
  severity: i.severity,
  rule,
  param: i.param,
  params: i.param ? [i.param] : [],
  message: i.message,
});

/** Why the values do not make a box in this material: every rule broken, errors and warnings. */
export function explain(recipe: StyleRecipe, values: ParamValues, material: MaterialSpec): Violation[] {
  const params = paramsOf(recipe);
  const keys = new Set(params.map((p) => p.key));
  const v = withDefaults(defaultsOf(recipe), values);
  const out: Violation[] = [];

  const schema = schemaIssues(params, v);
  for (const i of schema) {
    const p = params.find((q) => q.key === i.param);
    const raw = i.param ? Number(v[i.param]) : NaN;
    out.push({
      ...fromIssue(i, "schema"),
      ...(i.code === "size.out_of_range" && p ? { expected: { min: p.min, max: p.max }, actual: raw } : {}),
    });
  }
  if (schema.some((i) => i.severity === "error")) return out;
  out.push(...materialIssues(recipe, material, v).map((i) => fromIssue(i, "material")));
  if (out.some((x) => x.severity === "error")) return out;

  const ctx = recipeContext(recipe, v, material, materialRules(material));
  let built: Dieline;
  try {
    built = drawRecipe(recipe, ctx);
  } catch (e) {
    return [
      ...out,
      {
        code: "geometry.build_failed",
        severity: "error",
        rule: "geometry",
        params: [],
        message: { th: (e as Error).message, en: (e as Error).message },
      },
    ];
  }

  for (const { constraint: c } of recipeConstraints(recipe)) {
    const node = compile(c.require);
    if (evaluate(node, ctx.scope) !== false) continue;
    const violation: Violation = {
      code: c.code,
      severity: c.severity,
      rule: c.stage === "manufacturing" ? "manufacturing" : "constraint",
      constraintId: c.id,
      param: c.param,
      params: [...new Set([...(c.param ? [c.param] : []), ...paramsRead(c.require, keys, dimsOf(recipe))])],
      message: c.message,
    };
    if (node.t === "bin" && ["<", "<=", ">", ">="].includes(node.op)) {
      const actual = evaluate(node.a, ctx.scope);
      const bound = evaluate(node.b, ctx.scope);
      if (typeof actual === "number" && typeof bound === "number") {
        violation.actual = actual;
        violation.expected = node.op.startsWith("<") ? { max: bound } : { min: bound };
      }
    }
    out.push(violation);
  }
  for (const u of recipeUses(recipe).all) {
    if (u.def.check) out.push(...u.def.check(ctx, u.cfg, built).map((i) => fromIssue(i, "geometry")));
    const rule = MODULE_MANUFACTURING[u.def.id];
    if (rule) out.push(...rule(ctx, u.cfg, built).map((i) => fromIssue(i, "manufacturing")));
  }
  out.push(...dielineManufacturing(built, material).map((i) => fromIssue(i, "manufacturing")));
  return out;
}

/** True when the values pass every error rule (warnings allowed). */
export const isBuildable = (recipe: StyleRecipe, values: ParamValues, material: MaterialSpec) =>
  !explain(recipe, values, material).some((x) => x.severity === "error");

export interface ParamRange {
  param: string;
  /** The parameter's own limits (the schema). */
  domain: [number, number];
  /** The value the others were held at while this one was solved. */
  at: number;
  /** Where it passes with the others held, mm — empty when no value does. */
  intervals: [number, number][];
}

/** Samples across each domain; boundaries are then refined to `RESOLUTION_MM`. */
const SAMPLES = 32;
export const RESOLUTION_MM = 0.01;

/** The numeric parameters a size solve covers: active, bounded, and set (given or defaulted). */
function solvable(recipe: StyleRecipe, v: ParamValues): ParamSchema[] {
  return paramsOf(recipe).filter(
    (p) =>
      (p.kind === "length" || p.kind === "number" || p.kind === "angle") &&
      p.min !== undefined &&
      p.max !== undefined &&
      isActive(p, v) &&
      typeof v[p.key] === "number",
  );
}

/**
 * For each size parameter, the values that make a valid box in this material with every other
 * parameter held at `at` (default: the first preset). Found by sampling the parameter's domain and
 * bisecting each change between pass and fail, so a gap narrower than a sample step can be missed —
 * the property tests guard the boundaries this reports.
 */
export function validRanges(recipe: StyleRecipe, material: MaterialSpec, at?: ParamValues): ParamRange[] {
  const v = withDefaults(defaultsOf(recipe), at ?? presetsOf(recipe)[0].values);
  return solvable(recipe, v).map((p) => {
    const lo = p.min!;
    const hi = p.max!;
    const ok = (x: number) => isBuildable(recipe, { ...v, [p.key]: x }, material);
    const bisect = (bad: number, good: number) => {
      while (Math.abs(good - bad) > RESOLUTION_MM / 2) {
        const mid = (bad + good) / 2;
        if (ok(mid)) good = mid;
        else bad = mid;
      }
      return good;
    };
    const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => lo + ((hi - lo) * i) / SAMPLES);
    const pass = xs.map(ok);
    const intervals: [number, number][] = [];
    for (let i = 0; i < xs.length; i++) {
      if (!pass[i] || (i > 0 && pass[i - 1])) continue;
      let j = i;
      while (j + 1 < xs.length && pass[j + 1]) j++;
      const start = i === 0 ? xs[0] : bisect(xs[i - 1], xs[i]);
      const end = j === xs.length - 1 ? xs[j] : bisect(xs[j + 1], xs[j]);
      intervals.push([start, end]);
    }
    return { param: p.key, domain: [lo, hi], at: v[p.key] as number, intervals };
  });
}

/**
 * The size range per parameter for a material, as the library shows it (U3.B2 caches it per
 * material): the widest span the parameter's valid intervals reach around any preset.
 */
export function sizeRanges(recipe: StyleRecipe, material: MaterialSpec): Record<string, { min: number; max: number }> {
  const out: Record<string, { min: number; max: number }> = {};
  for (const preset of presetsOf(recipe)) {
    for (const r of validRanges(recipe, material, preset.values)) {
      for (const [a, b] of r.intervals) {
        const cur = out[r.param];
        out[r.param] = cur ? { min: Math.min(cur.min, a), max: Math.max(cur.max, b) } : { min: a, max: b };
      }
    }
  }
  return out;
}
