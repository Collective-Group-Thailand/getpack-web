import { callsOf, compile, namesOf } from "../expr";
import { FACE_LABELS, PIECE_LABELS } from "../labels";
import { getModule } from "../modules";
import type { BodyKind, Constraint, ModuleDef, ModuleSlot } from "../modules/types";
import type { BoxCategory, MaterialSpec } from "../types";
import { EXPRESSION_FUNCTIONS } from "./context";
import { defaultsOf, presetsOf, RecipeError, resolveParam } from "./params";
import type { RecipeModule, StyleRecipe } from "./types";

const CATEGORIES: BoxCategory[] = ["folding_carton", "corrugated", "tray_lid", "specialty", "flat"];
const KINDS: MaterialSpec["kind"][] = ["paperboard", "corrugated", "rigid", "label", "flexible"];

const expr = (src: unknown, path: string) => {
  if (typeof src === "number" || typeof src === "boolean") return;
  if (typeof src !== "string") throw new RecipeError("recipe.bad_expression", path, "expected an expression");
  try {
    compile(src);
  } catch (e) {
    throw new RecipeError("recipe.bad_expression", path, (e as Error).message);
  }
};

function checkConstraints(list: Constraint[], path: string) {
  list.forEach((c, i) => {
    const at = `${path}[${i}]`;
    if (!c.id || !c.code || !c.message?.th || !c.message?.en)
      throw new RecipeError("recipe.bad_constraint", at, "id, code and a Thai and English message are required");
    if (c.severity !== "error" && c.severity !== "warning")
      throw new RecipeError("recipe.bad_constraint", at, `severity "${String(c.severity)}"`);
    expr(c.require, `${at}.require`);
  });
}

function moduleOf(use: RecipeModule | undefined, slot: ModuleSlot, path: string): ModuleDef | undefined {
  if (!use) return undefined;
  const def = getModule(use.module);
  if (!def) throw new RecipeError("recipe.unknown_module", path, `"${use.module}"`);
  if (def.slot !== slot)
    throw new RecipeError("recipe.wrong_slot", path, `"${use.module}" is a ${def.slot}, not a ${slot}`);
  if (use.preset && !def.presets?.[use.preset])
    throw new RecipeError("recipe.unknown_preset", path, `"${use.module}" has no preset "${use.preset}"`);
  const cfg = { ...(use.preset ? def.presets![use.preset] : {}), ...use.with };
  const dims = cfg.dims;
  if (dims && typeof dims === "object" && !Array.isArray(dims))
    for (const [k, e] of Object.entries(dims)) expr(e, `${path}.dims.${k}`);
  if (Array.isArray(cfg.panels))
    cfg.panels.forEach((p, i) => {
      const panel = p as { label?: string; width?: unknown };
      if (!(String(panel.label) in FACE_LABELS))
        throw new RecipeError("recipe.unknown_label", `${path}.panels[${i}]`, `face label "${String(panel.label)}"`);
      expr(panel.width, `${path}.panels[${i}].width`);
    });
  for (const k of [
    "depth",
    "glue",
    "glueRight",
    "length",
    "width",
    "height",
    "cornerFlap",
    "slot",
    "tongue",
    "clearance",
  ])
    if (k in cfg) expr(cfg[k], `${path}.${k}`);
  if (Array.isArray(cfg.depths)) cfg.depths.forEach((e, i) => expr(e, `${path}.depths[${i}]`));
  const piece = cfg.piece as { label?: string } | undefined;
  if (piece && !(String(piece.label) in PIECE_LABELS))
    throw new RecipeError("recipe.unknown_label", `${path}.piece`, `piece label "${String(piece.label)}"`);
  const constraints = typeof def.constraints === "function" ? def.constraints(cfg) : (def.constraints ?? []);
  checkConstraints(constraints, `${path}(${def.id}).constraints`);
  return def;
}

const fits = (def: ModuleDef | undefined, kind: BodyKind, path: string) => {
  if (def && (def.slot === "closure" || def.slot === "feature") && !def.fits.includes(kind))
    throw new RecipeError("recipe.does_not_fit", path, `"${def.id}" does not attach to a ${kind} body`);
};

/**
 * Checks a recipe read from JSON and returns it typed: structure, parameters, modules (known, in
 * the right slot, fitting the body), every expression compiles and calls only known functions,
 * every face and piece label exists, and no refused module combination is used.
 */
export function parseRecipe(raw: unknown): StyleRecipe {
  if (!raw || typeof raw !== "object") throw new RecipeError("recipe.not_an_object", "$", typeof raw);
  const r = raw as StyleRecipe;
  const id = typeof r.id === "string" ? r.id : "?";
  const at = (p: string) => `${id}.${p}`;
  if (r.schemaVersion !== 1)
    throw new RecipeError("recipe.schema_version", at("schemaVersion"), String(r.schemaVersion));
  if (!/^[a-z0-9-]+$/.test(id)) throw new RecipeError("recipe.bad_id", at("id"), id);
  if (!CATEGORIES.includes(r.category))
    throw new RecipeError("recipe.bad_category", at("category"), String(r.category));
  for (const k of ["name", "description"] as const)
    if (!r[k]?.th || !r[k]?.en) throw new RecipeError("recipe.missing_words", at(k), "Thai and English are required");
  if (!Array.isArray(r.materials) || !r.materials.length || r.materials.some((m) => !KINDS.includes(m)))
    throw new RecipeError("recipe.bad_materials", at("materials"), JSON.stringify(r.materials));
  if (!Array.isArray(r.params)) throw new RecipeError("recipe.bad_params", at("params"), "expected a list");
  const keys = r.params.map((p, i) => resolveParam(p, at(`params[${i}]`)).key);
  if (new Set(keys).size !== keys.length) throw new RecipeError("recipe.duplicate_param", at("params"), keys.join(","));
  if (!presetsOf(r).length) throw new RecipeError("recipe.no_presets", at("presets"), "");
  defaultsOf(r);
  if (!r.body === !r.pieceSet)
    throw new RecipeError("recipe.body_or_piece_set", at("body"), "exactly one of body / pieceSet");

  const body = moduleOf(r.body, "body", at("body"));
  moduleOf(r.pieceSet, "pieceSet", at("pieceSet"));
  const kind: BodyKind = body?.slot === "body" ? body.kind : "special";
  const top = moduleOf(r.closures?.top, "closure", at("closures.top"));
  const bottom = moduleOf(r.closures?.bottom, "closure", at("closures.bottom"));
  fits(top, kind, at("closures.top"));
  fits(bottom, kind, at("closures.bottom"));
  const features = (r.features ?? []).map((f, i) => {
    const def = moduleOf(f, "feature", at(`features[${i}]`));
    fits(def, kind, at(`features[${i}]`));
    return def!;
  });
  checkConstraints(r.constraints ?? [], at("constraints"));
  for (const [axis, options] of Object.entries(r.variants ?? {}))
    for (const [value, set] of Object.entries(options))
      for (const k of Object.keys(set))
        if (!keys.includes(k))
          throw new RecipeError(
            "recipe.unknown_param",
            at(`variants.${axis}.${value}`),
            `"${k}" is not a parameter of this recipe`,
          );
  if (r.closedSize)
    for (const k of ["length", "width", "height"] as const) expr(r.closedSize[k], at(`closedSize.${k}`));
  for (const [k, e] of Object.entries(r.outerSize ?? {})) {
    if (!["length", "width", "height"].includes(k))
      throw new RecipeError("recipe.bad_outer_size", at(`outerSize.${k}`), k);
    expr(e, at(`outerSize.${k}`));
  }

  const used = new Set([body, top, bottom, ...features].filter(Boolean).map((d) => d!.id));
  for (const rule of r.incompatible ?? [])
    if (rule.modules.every((m) => used.has(m)))
      throw new RecipeError(rule.code || "recipe.incompatible", at("incompatible"), rule.modules.join(" + "));

  // Every function an expression calls must exist (names are free: an unset one is just missing).
  for (const src of collectExpressions(r))
    for (const call of callsOf(src))
      if (!EXPRESSION_FUNCTIONS.includes(call))
        throw new RecipeError("recipe.unknown_function", at("$"), `${call}() in "${src}"`);
  return r;
}

/** Every expression string a recipe holds (for checks and for the solver's dependency map). */
export function collectExpressions(r: StyleRecipe): string[] {
  const out: string[] = [];
  const cfgExprs = (use?: RecipeModule) => {
    if (!use) return;
    const def = getModule(use.module);
    const cfg = { ...(use.preset ? def?.presets?.[use.preset] : {}), ...use.with };
    const dims = cfg.dims as Record<string, unknown> | undefined;
    for (const e of Object.values(dims ?? {})) if (typeof e === "string") out.push(e);
    for (const k of [
      "depth",
      "glue",
      "glueRight",
      "length",
      "width",
      "height",
      "cornerFlap",
      "slot",
      "tongue",
      "clearance",
    ])
      if (typeof cfg[k] === "string") out.push(cfg[k] as string);
    for (const e of (cfg.depths as unknown[]) ?? []) if (typeof e === "string") out.push(e);
    for (const p of (cfg.panels as { width?: unknown }[]) ?? []) if (typeof p.width === "string") out.push(p.width);
    const cs = def ? (typeof def.constraints === "function" ? def.constraints(cfg) : (def.constraints ?? [])) : [];
    for (const c of cs) out.push(c.require);
  };
  [r.body, r.pieceSet, r.closures?.top, r.closures?.bottom, ...(r.features ?? [])].forEach(cfgExprs);
  for (const c of r.constraints ?? []) out.push(c.require);
  if (r.closedSize) out.push(r.closedSize.length, r.closedSize.width, r.closedSize.height);
  out.push(...Object.values(r.outerSize ?? {}).filter((e): e is string => typeof e === "string"));
  return out;
}

export { namesOf };
