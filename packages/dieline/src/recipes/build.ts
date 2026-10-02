import { compile, evaluate } from "../expr";
import { getModule } from "../modules";
import type { BuildContext, Constraint, ModuleConfig, ModuleDef, ModuleUse, Parts } from "../modules/types";
import { issue, withDefaults } from "../params";
import { defineStyle } from "../styles/_shared";
import type { BoxStyleDef, Dieline, HingeMap, Issue, MaterialSpec, ParamValues } from "../types";
import { contextFor } from "./context";
import { defaultsOf, presetsOf, resolveParam } from "./params";
import type { RecipeModule, StyleRecipe } from "./types";

/*
 * From recipe to dieline (ADR-0011): the modules are looked up, their settings merged (preset
 * under `with`), the body's `dims` evaluated, and the body (or piece set) builds with the
 * closures and features attached. The hinge map is the merge of every module's part of it; the
 * rules are the recipe's own, then each module's data rules and coded checks, in recipe order.
 */

function moduleUse(rm: RecipeModule | undefined, end?: "top" | "bottom"): ModuleUse | undefined {
  if (!rm) return undefined;
  const def = getModule(rm.module);
  if (!def) throw new Error(`recipe.unknown_module: ${rm.module}`);
  const cfg: ModuleConfig = { ...(rm.preset ? def.presets?.[rm.preset] : {}), ...rm.with };
  return { def, cfg, end };
}

interface Uses {
  main: ModuleUse;
  parts: Parts;
  /** Every module in rule order: body or piece set, top, bottom, features. */
  all: ModuleUse[];
}

function resolveUses(recipe: StyleRecipe): Uses {
  const main = moduleUse(recipe.body ?? recipe.pieceSet)!;
  const parts: Parts = {
    top: moduleUse(recipe.closures?.top, "top"),
    bottom: moduleUse(recipe.closures?.bottom, "bottom"),
    features: (recipe.features ?? []).map((f) => moduleUse(f)!),
  };
  const all = [main, parts.top, parts.bottom, ...parts.features].filter((u): u is ModuleUse => !!u);
  return { main, parts, all };
}

const usesCache = new WeakMap<StyleRecipe, Uses>();
const uses = (r: StyleRecipe) => {
  let u = usesCache.get(r);
  if (!u) usesCache.set(r, (u = resolveUses(r)));
  return u;
};

/** The build context for a recipe at these values (defaults already applied). */
export function recipeContext(recipe: StyleRecipe, v: ParamValues, m: MaterialSpec): BuildContext {
  return contextFor(recipe.id, v, m, (uses(recipe).main.cfg.dims ?? {}) as Record<string, string>);
}

function draw(recipe: StyleRecipe, ctx: BuildContext): Dieline {
  const { main, parts } = uses(recipe);
  if (main.def.slot === "pieceSet") return main.def.build(ctx, main.cfg);
  if (main.def.slot !== "body") throw new Error(`recipe.no_body: ${recipe.id}`);
  return main.def.build(ctx, main.cfg, parts);
}

const foldable = (recipe: StyleRecipe) => {
  const { main } = uses(recipe);
  return main.def.slot !== "body" || main.def.folds;
};

function hinges(recipe: StyleRecipe, ctx: BuildContext): HingeMap {
  const out: HingeMap = { roots: {} };
  for (const u of uses(recipe).all) {
    const part = u.def.hinges?.(ctx, u.cfg, u.end);
    if (!part) continue;
    if (part.roots) Object.assign(out.roots, part.roots);
    if (part.angles) out.angles = { ...out.angles, ...part.angles };
    if (part.stages) out.stages = { ...out.stages, ...part.stages };
    if (part.upright) out.upright = part.upright;
    if (part.placement) out.placement = { ...out.placement, ...part.placement };
  }
  return out;
}

const constraintsOf = (def: ModuleDef, cfg: ModuleConfig): Constraint[] =>
  typeof def.constraints === "function" ? def.constraints(cfg) : (def.constraints ?? []);

/** `{{name}}` in a message is replaced by that value, rounded to 0.1. */
function interpolate(text: string, ctx: BuildContext): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_m, e: string) => {
    const x = evaluate(compile(e.trim()), ctx.scope);
    return typeof x === "number" ? String(Math.round(x * 10) / 10) : String(x ?? "");
  });
}

/** Whether a constraint is broken: its `require` is definitely false. */
export function broken(c: Constraint, ctx: BuildContext): boolean {
  return evaluate(compile(c.require), ctx.scope) === false;
}

const toIssue = (c: Constraint, ctx: BuildContext): Issue =>
  issue(c.code, { th: interpolate(c.message.th, ctx), en: interpolate(c.message.en, ctx) }, c.param, c.severity);

/** Every constraint of a recipe in rule order, deduplicated by id (a tuck at both ends is checked once). */
export function recipeConstraints(recipe: StyleRecipe): { constraint: Constraint; use?: ModuleUse }[] {
  const seen = new Set<string>();
  const out: { constraint: Constraint; use?: ModuleUse }[] = [];
  const add = (c: Constraint, use?: ModuleUse) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ constraint: c, use });
  };
  for (const c of recipe.constraints ?? []) add(c);
  for (const u of uses(recipe).all) for (const c of constraintsOf(u.def, u.cfg)) add(c, u);
  return out;
}

/** The style's own rules on values with defaults applied: data rules, then each module's coded checks. */
function check(recipe: StyleRecipe, v: ParamValues, m: MaterialSpec, built: Dieline): Issue[] {
  const ctx = recipeContext(recipe, v, m);
  const out: Issue[] = [];
  const seen = new Set<string>();
  const rule = (c: Constraint) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    if (broken(c, ctx)) out.push(toIssue(c, ctx));
  };
  (recipe.constraints ?? []).forEach(rule);
  for (const u of uses(recipe).all) {
    constraintsOf(u.def, u.cfg).forEach(rule);
    if (u.def.check) out.push(...u.def.check(ctx, u.cfg, built));
  }
  return out;
}

export interface BuiltRecipe {
  dieline: Dieline;
  /** How it folds; `null` for flat pieces (D-152). */
  hinges: HingeMap | null;
  /** The parameter limits it was built within (the constraint solver narrows them, U3.2). */
  limits: Record<string, { min?: number; max?: number }>;
}

/** Builds a recipe at the given values (defaults filled in) for a board: dieline, fold and limits. */
export function buildFromRecipe(recipe: StyleRecipe, values: ParamValues, material: MaterialSpec): BuiltRecipe {
  const v = withDefaults(defaultsOf(recipe), values);
  const ctx = recipeContext(recipe, v, material);
  const limits: BuiltRecipe["limits"] = {};
  for (const p of recipe.params.map((x) => resolveParam(x)))
    if (p.min !== undefined || p.max !== undefined) limits[p.key] = { min: p.min, max: p.max };
  return { dieline: draw(recipe, ctx), hinges: foldable(recipe) ? hinges(recipe, ctx) : null, limits };
}

/** A recipe as the engine's `BoxStyleDef`, so the registry and every caller stay as they were. */
export function styleFromRecipe(recipe: StyleRecipe): BoxStyleDef {
  const { closedSize } = recipe;
  return defineStyle({
    id: recipe.id,
    category: recipe.category,
    name: recipe.name,
    description: recipe.description,
    ...(recipe.codes ? { codes: recipe.codes } : {}),
    materials: recipe.materials,
    params: recipe.params.map((p) => resolveParam(p)),
    defaults: defaultsOf(recipe),
    presets: presetsOf(recipe),
    ...(foldable(recipe)
      ? { faces3d: (v: ParamValues, m: MaterialSpec) => hinges(recipe, recipeContext(recipe, v, m)) }
      : {}),
    ...(closedSize
      ? {
          closedSize: (v: ParamValues, m: MaterialSpec) => {
            const ctx = recipeContext(recipe, v, m);
            return {
              length: ctx.num(closedSize.length),
              width: ctx.num(closedSize.width),
              height: ctx.num(closedSize.height),
            };
          },
        }
      : {}),
    make: (v, m) => draw(recipe, recipeContext(recipe, v, m)),
    check: (v, m, built) => check(recipe, v, m, built),
    ...(recipe.legacy ? { legacy: recipe.legacy } : {}),
  });
}
