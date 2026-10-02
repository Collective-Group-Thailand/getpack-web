import { describe, expect, it } from "vitest";

import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "./materials";
import { isActive } from "./params";
import { hingeMapOf, resolveValues, STYLES } from "./styles";
import type { BoxStyleDef, MaterialSpec, ParamValues } from "./types";

/**
 * U3.1 regression net: what every style builds, folds and reports, for every preset on every
 * reference board of its category and for a fixed matrix of options, as one hash per case in
 * `fixtures/baseline/<style>.json`. It was written from the hand-written styles before they
 * became recipes, so a recipe that draws, folds or validates one byte differently fails here.
 * A deliberate change is accepted with `vitest -u` and explained in PROGRESS.
 */

/** Object keys sorted, arrays kept in order: key order is not behaviour, array order is. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

/** cyrb53: a 53-bit string hash — collisions are irrelevant at this size, and no Node API is needed. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

const attempt = (f: () => unknown): string => {
  try {
    return hash(canonical(f()));
  } catch (e) {
    return `throws: ${(e as Error).message}`;
  }
};

/** Single-option changes from a preset: every enum option, every boolean flipped, numbers at their limits. */
function variations(style: BoxStyleDef, base: ParamValues): [string, ParamValues][] {
  const out: [string, ParamValues][] = [];
  const v = resolveValues(style, base);
  for (const p of style.params) {
    if (p.kind === "enum") {
      for (const o of p.options ?? []) out.push([`${p.key}=${o.value}`, { ...base, [p.key]: o.value }]);
    } else if (p.kind === "boolean") {
      out.push([`${p.key}=${String(!v[p.key])}`, { ...base, [p.key]: !v[p.key] }]);
    } else if (p.kind === "length" || p.kind === "number" || p.kind === "angle") {
      if (p.min !== undefined) out.push([`${p.key}=min`, { ...base, [p.key]: p.min }]);
      if (p.max !== undefined) out.push([`${p.key}=max`, { ...base, [p.key]: p.max }]);
      if (p.min !== undefined) out.push([`${p.key}<min`, { ...base, [p.key]: p.min - 1 }]);
      if (p.max !== undefined) out.push([`${p.key}>max`, { ...base, [p.key]: p.max + 1 }]);
    }
  }
  // Windows: every shape on every panel it may sit on, and one far too large for any panel.
  const shape = style.params.find((p) => p.key === "window");
  const panel = style.params.find((p) => p.key === "windowPanel");
  if (shape && panel) {
    for (const s of shape.options ?? []) {
      if (s.value === "none") continue;
      for (const at of panel.options ?? []) {
        const w = { ...base, window: s.value, windowPanel: at.value };
        if (!isActive(panel, resolveValues(style, w))) continue;
        out.push([`window=${s.value}@${at.value}`, w]);
      }
      out.push([`window=${s.value}:oversized`, { ...base, window: s.value, windowWidth: 590, windowHeight: 590 }]);
    }
  }
  return out;
}

function record(style: BoxStyleDef, values: ParamValues, m: MaterialSpec) {
  return {
    build: attempt(() => style.build(values, m)),
    hinges: attempt(() => hingeMapOf(style, values, m)),
    validate: attempt(() => style.validate(values, m)),
    closed: attempt(() => style.closedSize?.(resolveValues(style, values), m) ?? null),
  };
}

describe.each(STYLES.map((style) => ({ style })))("baseline · $style.id", ({ style }) => {
  it("builds, folds and validates as it did before the recipe engine", async () => {
    const materials = REFERENCE_BY_CATEGORY[style.category].map((id) => [id, REFERENCE_MATERIALS[id]] as const);
    const cases: Record<string, unknown> = {
      definition: hash(
        canonical({
          id: style.id,
          category: style.category,
          name: style.name,
          description: style.description,
          codes: style.codes ?? null,
          params: style.params,
          defaults: style.defaults,
          presets: style.presets,
          materials: style.materials,
          legacy: style.legacy ?? null,
        }),
      ),
    };
    for (const preset of style.presets) {
      for (const [materialId, m] of materials) cases[`${preset.id} · ${materialId}`] = record(style, preset.values, m);
    }
    const [firstId, first] = materials[0];
    for (const [label, values] of variations(style, style.presets[0].values)) {
      cases[`${style.presets[0].id} · ${firstId} · ${label}`] = record(style, values, first);
    }
    await expect(`${JSON.stringify(cases, null, 2)}\n`).toMatchFileSnapshot(`../fixtures/baseline/${style.id}.json`);
  });
});
