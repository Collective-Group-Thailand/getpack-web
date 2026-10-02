import * as constants from "../constants";
import {
  allowancesOf,
  glueWidthFor,
  MIN_SLOT_MM,
  SLOT_CALIPER_FACTOR,
  snapLockTongueFor,
  tuckDepthFor,
} from "../constants";
import { compile, evaluate, type ExprFunction, type ExprValue, type Scope } from "../expr";
import type { BuildContext } from "../modules/types";
import type { MaterialSpec, ParamValue, ParamValues } from "../types";

/**
 * The names and functions a recipe expression can use:
 * - every parameter by its key, as a number when it reads as one (`num` semantics) — the body's
 *   named sizes (`front`, `side`, `depth`…) shadow parameters of the same name;
 * - `t` the caliper, `a.panel` `a.depth` `a.trayDepth` `a.flap` `a.gluePanel` the make-up
 *   allowances (`allowancesOf`), `material.kind`, `material.flute`, `pi`;
 * - `C.<NAME>` any numeric constant in `constants.ts`;
 * - `min max abs floor ceil round sqrt sin cos tan number`, and the legacy tables
 *   `tuckDepthFor(L)`, `glueWidthFor(W)`, `snapLockTongueFor(W)`, `slotWidth()`.
 */

const numeric = (xs: ExprValue[]): xs is number[] => xs.every((x) => typeof x === "number");
const math =
  (f: (...n: number[]) => number): ExprFunction =>
  (...xs) =>
    numeric(xs) ? f(...xs) : undefined;

/** Slot width between corrugated flaps: two calipers, at least 3 mm (0 = a slit in paperboard). */
export function slotWidth(m: MaterialSpec): number {
  return m.kind === "corrugated" ? Math.max(MIN_SLOT_MM, SLOT_CALIPER_FACTOR * m.caliperMm) : 0;
}

function functionsFor(m: MaterialSpec): Record<string, ExprFunction> {
  return {
    min: math(Math.min),
    max: math(Math.max),
    abs: math(Math.abs),
    floor: math(Math.floor),
    ceil: math(Math.ceil),
    round: math(Math.round),
    sqrt: math(Math.sqrt),
    sin: math(Math.sin),
    cos: math(Math.cos),
    tan: math(Math.tan),
    number: (x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : undefined),
    tuckDepthFor: math(tuckDepthFor),
    glueWidthFor: math((w) => glueWidthFor(w, m)),
    snapLockTongueFor: math(snapLockTongueFor),
    slotWidth: () => slotWidth(m),
  };
}

export const EXPRESSION_FUNCTIONS = Object.keys(functionsFor({ caliperMm: 0, kind: "paperboard" }));

/** A parameter value as an expression sees it: numbers for anything numeric, `undefined` for empty. */
function readParam(raw: ParamValue | undefined): ExprValue {
  if (raw === undefined) return undefined;
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

const CONSTANTS = constants as unknown as Record<string, unknown>;

export function scopeFor(v: ParamValues, m: MaterialSpec, dims: Record<string, number>): Scope {
  const a = allowancesOf(m) as unknown as Record<string, number>;
  return {
    fn: functionsFor(m),
    get(name) {
      if (name in dims) return dims[name];
      if (name === "t") return Math.max(0, m.caliperMm);
      if (name === "pi") return Math.PI;
      if (name === "material.kind") return m.kind;
      if (name === "material.flute") return m.flute ?? undefined;
      if (name.startsWith("a.")) return a[name.slice(2)];
      if (name.startsWith("C.")) {
        const c = CONSTANTS[name.slice(2)];
        return typeof c === "number" ? c : undefined;
      }
      return readParam(v[name]);
    },
  };
}

/**
 * A build context: `dims` are evaluated in order, each seeing the ones before it (and, under its
 * own name, the parameter it may default from — `cornerFlap ?? …`).
 */
export function contextFor(
  styleId: string,
  v: ParamValues,
  m: MaterialSpec,
  dimsExpr: Record<string, string> = {},
): BuildContext {
  const dims: Record<string, number> = {};
  const scope = scopeFor(v, m, dims);
  const value = (e: string | number | boolean) => (typeof e === "string" ? evaluate(compile(e), scope) : e);
  for (const [name, e] of Object.entries(dimsExpr)) {
    const x = value(e);
    dims[name] = typeof x === "number" ? x : NaN;
  }
  return {
    styleId,
    v,
    m,
    dims,
    scope,
    num: (e) => {
      const x = value(e);
      return typeof x === "number" ? x : NaN;
    },
    test: (e) => value(e) === true,
  };
}
