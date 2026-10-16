import { describe, expect, it } from "vitest";
import { getStyle } from "@getpack/dieline";

import { evaluateDocumentLikeTheApi } from "../../../../mocks/store/studio";
import VENDORED from "../../../../contract/studio-rules.json";
import type { DesignContent, DesignElement } from "../types";
import { activeRules, designIssues, RULE_IDS, type PrintRule, type RuleId } from "./checks";
import { applyFix } from "./fixes";
import { elementCorners, localSize } from "./geometry";
import { sheetOf } from "./useIssues";

/**
 * U4.5 acceptance: a fixture design that triggers each rule of the catalogue, its safe fix leaving no
 * violation of that rule, and the client and the server (getpack-api's evaluator, as the mock ports
 * it) finding the same rule ids for the same document.
 */

// Every rule on: the seeded thresholds, plus test values where the seed leaves a rule off.
const RULES: PrintRule[] = (VENDORED.rules as PrintRule[]).map((r) => ({
  ...r,
  thresholds:
    r.thresholds ??
    ({
      min_text_size: { minPt: 6 },
      spot_colour_count: { maxColours: 2 },
      finish_min_feature: { minFeatureMm: 1 },
      rich_black_small_text: {},
      white_ink_needed: {},
    }[r.id] as Record<string, number> | undefined) ??
    {},
}));
const d = getStyle("tuck-end").build({ length: 70, width: 40, height: 150 }, { caliperMm: 0.45, kind: "paperboard" });
const sheet = sheetOf(d, 3);
const cornersOf = (el: DesignElement) => elementCorners(el, localSize(el));
const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const front = { x: 15, y: 55.45, w: 70.45, h: 150.9 }; // the tuck end's front panel

const text = (id: string, x: number, y: number, fontSize = 5, fill = "#111111"): DesignElement =>
  ({
    ...base,
    id,
    type: "text",
    x,
    y,
    text: "getpack",
    fontSize,
    fontFamily: "Sarabun",
    fontStyle: "normal",
    fill,
    align: "left",
  }) as DesignElement;
const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<DesignElement> = {},
): DesignElement =>
  ({
    ...base,
    id,
    type: "rect",
    x,
    y,
    width: w,
    height: h,
    fill: "#1f6f78",
    stroke: "#000000",
    strokeWidth: 0,
    cornerRadius: 0,
    ...extra,
  }) as DesignElement;
const code = (id: string, x: number, y: number, value: string, width = 37.3): DesignElement =>
  ({
    ...base,
    id,
    type: "code",
    kind: "ean13",
    x,
    y,
    value,
    width,
    height: 26,
    fill: "#000000",
    background: "#ffffff",
  }) as DesignElement;

const FIXTURES: Partial<Record<RuleId, DesignElement[]>> = {
  image_resolution: [
    {
      ...base,
      id: "img",
      type: "image",
      src: "",
      x: 25,
      y: 70,
      width: 50,
      height: 50,
      naturalWidth: 200,
      naturalHeight: 200,
    } as DesignElement,
  ],
  // Near the left panel's outer cut edge (x = 236.35), not past it.
  bleed: [rect("bg", 220, 100, 15, 40)],
  safe_zone: [text("edge", front.x + 0.5, front.y + 30)],
  min_text_size: [text("tiny", front.x + 10, front.y + 30, 1.5)],
  hairline: [rect("line", front.x + 10, front.y + 40, 30, 20, { strokeWidth: 0.05 })],
  rgb_out_of_gamut: [rect("neon", front.x + 10, front.y + 40, 20, 20, { fill: "#00ff40" })],
  spot_colour_count: [
    text("c1", front.x + 10, front.y + 20, 5, "#ff0000"),
    text("c2", front.x + 10, front.y + 40, 5, "#00ff00"),
    text("c3", front.x + 10, front.y + 60, 5, "#0000ff"),
  ],
  crosses_crease: [text("fold", front.x + front.w - 10, front.y + 40, 5)],
  crosses_glue: [rect("glue", 2, 100, 8, 10)],
  barcode_across_fold: [code("fold-code", front.x + front.w - 15, front.y + 40, "5901234123457")],
  barcode_invalid: [
    code("bad", front.x + 10, front.y + 40, "5901234123458"),
    code("small", front.x + 10, front.y + 90, "5901234123457", 25),
  ],
  finish_min_feature: [rect("foil-dot", front.x + 20, front.y + 40, 0.5, 0.5, { finish: "foil" })],
  element_right_missing: [
    { ...rect("mark", front.x + 10, front.y + 40, 20, 20), studioElementId: "cert" } as DesignElement,
  ],
};

/** The print method a fixture is checked under: the gamut rule is a CMYK one (digital, offset). */
const methodFor = (elements: DesignElement[]) => (elements.some((e) => e.id === "neon") ? "digital" : "flexo");
const rulesFor = (elements: DesignElement[]) =>
  activeRules(RULES, { printMethod: methodFor(elements), materialClass: null });

const check = (
  elements: DesignElement[],
  pattern: DesignContent["pattern"] = { kind: "none", color: "#000000", background: "#ffffff", size: 12 },
) => designIssues({ ...sheet, elements, cornersOf, rules: rulesFor(elements), pattern, undeclared: new Set(["cert"]) });

describe("print checks: one fixture per rule (U4.5)", () => {
  const implemented = RULE_IDS.filter((id) => !["rich_black_small_text", "white_ink_needed"].includes(id));

  it.each(implemented.map((id) => [id] as const))("%s is found, and its safe fix clears it", (id) => {
    const elements = FIXTURES[id]!;
    const found = check(elements).filter((i) => i.ruleId === id);
    expect(found.length, id).toBeGreaterThan(0);
    for (const issue of found) {
      expect(["block", "warn", "info"]).toContain(issue.severity);
      if (!issue.fix) continue;
      const fixed = applyFix(
        { elements, pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 } },
        issue,
        { cornersOf, safeZones: sheet.safeZones, outlines: sheet.outlines, rules: rulesFor(elements) },
      );
      const after = check(fixed.elements).filter(
        (i) => i.ruleId === id && i.elementId === issue.elementId && i.fix === issue.fix,
      );
      expect(after, `${id} after "${issue.fix}"`).toEqual([]);
    }
  });

  it("finds nothing on a clean design, and leaves a rule off while its thresholds are unset", () => {
    expect(check([text("ok", front.x + 15, front.y + 40, 5)])).toEqual([]);
    const seeded = activeRules(VENDORED.rules as PrintRule[], { printMethod: "digital", materialClass: null });
    expect(seeded.map((r) => r.id)).not.toContain("min_text_size");
    expect(seeded.map((r) => r.id)).not.toContain("spot_colour_count");
  });

  it("names every rule of getpack-api's catalogue", () => {
    expect([...RULE_IDS].sort()).toEqual((VENDORED.rules as PrintRule[]).map((r) => r.id).sort());
  });
});

describe("client and server find the same rule ids for the same document (U4.5 parity)", () => {
  it.each(Object.entries(FIXTURES))("%s", (_id, elements) => {
    const documentRules = rulesFor(elements!).filter((r) => r.evaluatedOn.includes("document"));
    const ids = new Set(documentRules.map((r) => r.id));
    const client = check(elements!)
      .filter((i) => ids.has(i.ruleId))
      .map((i) => `${i.ruleId}:${i.elementId}:${i.severity}`)
      .sort();
    const server = evaluateDocumentLikeTheApi(
      { content: { elements: elements!, pattern: { kind: "none" } } },
      documentRules as never,
      {
        undeclared: new Set(["cert"]),
      },
    )
      .map((f) => `${f.ruleId}:${f.elementId}:${f.severity}`)
      .sort();
    expect(client).toEqual(server);
  });
});
