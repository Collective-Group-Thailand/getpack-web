import { dielineToDxf } from "./export/dxf";
import { dielineToSvg } from "./export/svg";
import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "./materials";
import { resolveValues, STYLES } from "./styles";
import type { MaterialSpec, ParamValues } from "./types";

/**
 * Golden-comparison fixtures for getpack-api (B4.1): one drawing per legacy Locopack pattern key
 * the registry maps, from the published engine. getpack-api renders the same pattern at the same
 * `values` with the legacy drawing service and compares the two; `fixtures/patterns/*.svg` in
 * this package are the snapshots of this function's output, so a change to a style shows up as a
 * reviewed diff here before it reaches that comparison.
 */
export interface PatternFixture {
  /** The legacy key as `legacy.patternKeys` lists it: `pid:3`, `mapping:66`, `strap`… */
  patternKey: string;
  /** A file-safe form of the key (`pid-3`), the snapshot's name. */
  fileKey: string;
  styleId: string;
  presetId: string;
  materialId: string;
  material: MaterialSpec;
  /** Every parameter, defaults filled in — what to feed the legacy drawing service. */
  values: ParamValues;
  svg: string;
  dxf: string;
}

export const fixtureFileKey = (patternKey: string) => patternKey.replace(/[^A-Za-z0-9_-]+/g, "-");

/**
 * Each mapped legacy pattern, drawn with its style's first preset on the style's first reference
 * material. A key several styles claim is drawn once, by the first style in registry order.
 */
export function patternFixtures(): PatternFixture[] {
  const seen = new Set<string>();
  const out: PatternFixture[] = [];
  for (const style of STYLES) {
    const preset = style.presets[0];
    const materialId = REFERENCE_BY_CATEGORY[style.category][0];
    if (!preset || !materialId) continue;
    const material = REFERENCE_MATERIALS[materialId]!;
    const values = resolveValues(style, preset.values);
    const d = style.build(values, material);
    const svg = dielineToSvg(d);
    const dxf = dielineToDxf(d);
    for (const patternKey of style.legacy?.patternKeys ?? []) {
      if (seen.has(patternKey)) continue;
      seen.add(patternKey);
      out.push({
        patternKey,
        fileKey: fixtureFileKey(patternKey),
        styleId: style.id,
        presetId: preset.id,
        materialId,
        material,
        values,
        svg,
        dxf,
      });
    }
  }
  return out;
}
