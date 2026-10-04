import { pointInPolygon, type Pt } from "@packio/dieline";

import type { DesignElement } from "../types";
import { barModules, ean13Modules, qrMatrix } from "./codes";
import { outOfPrintGamut } from "./colour";
import { boxOf, segmentHitsPolygon } from "./geometry";

/**
 * The studio's print checks (U4.5, D-278): **one rule catalogue** shared with packio-api — the same
 * rule ids, severities and thresholds (setting `studio.print_rules`, served by
 * `store.studio.getRules`, vendored at the lock's tag in `contract/studio-rules.json`). A rule
 * whose thresholds are unset is off until Prepress sets them; a rule names the print methods and
 * material classes it applies to. The rules packio-api evaluates on the document
 * (`evaluatedOn: document`) are computed here exactly as its `evaluateDocument` does — same units,
 * same rounding — so the client and the server find the same ids for the same document; the
 * rest (`web`) only the studio can see (the die's geometry). Each finding names its element so a
 * click selects it, and carries a safe one-click fix where there is one (`fixes.ts`).
 */
export const RULE_IDS = [
  "image_resolution",
  "bleed",
  "safe_zone",
  "min_text_size",
  "hairline",
  "rich_black_small_text",
  "rgb_out_of_gamut",
  "spot_colour_count",
  "crosses_crease",
  "crosses_glue",
  "barcode_across_fold",
  "barcode_invalid",
  "white_ink_needed",
  "finish_min_feature",
  "element_right_missing",
] as const;
export type RuleId = (typeof RULE_IDS)[number] | "off_sheet";
export type Severity = "block" | "warn" | "info";
export type Surface = "document" | "web" | "pdf";

export interface PrintRule {
  id: string;
  severity: Severity;
  evaluatedOn: Surface[];
  printMethods: string[] | null;
  materialClasses: string[] | null;
  thresholds: Record<string, number | string> | null;
}

export type FixKind =
  | "move_inside"
  | "extend_to_bleed"
  | "min_text"
  | "min_stroke"
  | "min_code"
  | "nearest_spot"
  | "in_gamut";

export interface DesignIssue {
  ruleId: RuleId;
  severity: Severity;
  /** The element it concerns; `""` for a rule about the whole design (the spot-colour count). */
  elementId: string;
  /** Numbers and words for the message (ppi, pt, mm, colours, barcode problems…). */
  data?: Record<string, number | string>;
  fix?: FixKind;
}

export interface CheckInput {
  elements: DesignElement[];
  /** Each element's four corners on the sheet. */
  cornersOf: (el: DesignElement) => Pt[];
  /** Per face: its safe zone (largest polygon first; the rest are holes, e.g. around a window). */
  safeZones: Pt[][][];
  /** Every crease, perforation and half-cut as a segment (curves as chords). */
  folds: [Pt, Pt][];
  glueAreas: Pt[][];
  /** Each piece's outer outline (flattened). */
  outlines: Pt[][];
  /** The rules in force (`activeRules`). */
  rules: PrintRule[];
  /** The background's colours, counted by the spot-colour rule as the server counts them. */
  pattern?: { kind: string; color?: string; background?: string };
  /** Studio elements (ids) whose legal right the owner has not declared (D-282). */
  undeclared?: Set<string>;
}

/** The rules in force for a design: on (thresholds set), and for its print method and material class. */
export function activeRules(rules: PrintRule[], ctx: { printMethod: string | null; materialClass: string | null }) {
  return rules.filter(
    (r) =>
      r.thresholds !== null &&
      (r.printMethods === null || (ctx.printMethod !== null && r.printMethods.includes(ctx.printMethod))) &&
      (r.materialClasses === null || (ctx.materialClass !== null && r.materialClasses.includes(ctx.materialClass))),
  );
}

const PT_PER_MM = 72 / 25.4;
const num = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number(v));
const round = (n: number) => Math.round(n * 100) / 100;

function insideSafeZone(corners: Pt[], zones: Pt[][][]): boolean {
  return zones.some(([outer, ...holes]) => {
    if (!outer) return false;
    return corners.every((c) => pointInPolygon(c, outer) && !holes.some((h) => pointInPolygon(c, h)));
  });
}

function grow(corners: Pt[], mm: number): Pt[] {
  const b = boxOf(corners);
  return [
    [b.x - mm, b.y - mm],
    [b.x + b.width + mm, b.y - mm],
    [b.x + b.width + mm, b.y + b.height + mm],
    [b.x - mm, b.y + b.height + mm],
  ];
}

/** GS1 nominal widths incl. quiet zones at 100 % (mm); 80 % is the smallest allowed (D-283). */
const GS1_NOMINAL_MM: Partial<Record<string, number>> = { ean13: 37.29, upca: 37.29, ean8: 26.73 };

/** The smallest width a barcode may print at (mm, GS1 80 %), or `null` where none applies. */
export const barcodeMinWidth = (kind: string): number | null => {
  const nominal = GS1_NOMINAL_MM[kind];
  return nominal === undefined ? null : Math.round(nominal * 0.8 * 100) / 100;
};

/** The barcode's problems as packio-api's validation names them (D-283), size included. */
export function barcodeProblems(el: Extract<DesignElement, { type: "code" }>): string[] {
  const problems: string[] = [];
  if (el.kind === "qr") {
    if (!el.value) problems.push("empty");
    else if (!qrMatrix(el.value)) problems.push("too_long_for_level");
  } else if (el.kind === "code128") {
    if (!el.value) problems.push("empty");
    else if (!barModules("code128", el.value)) problems.push("not_ascii");
  } else {
    const length = { ean13: 13, ean8: 8, upca: 12 }[el.kind];
    if (!/^[0-9]+$/.test(el.value)) problems.push("digits_only");
    else if (el.value.length !== length) problems.push("wrong_length");
    else if (!(el.kind === "ean13" ? ean13Modules(el.value) : barModules(el.kind, el.value)))
      problems.push("check_digit");
  }
  const minWidth = barcodeMinWidth(el.kind);
  const width = el.width * Math.abs(el.scaleX);
  if (minWidth !== null && width > 0 && width < minWidth) problems.push("too_small");
  return problems;
}

export function designIssues(input: CheckInput): DesignIssue[] {
  const out: DesignIssue[] = [];
  const rule = (id: RuleId) => input.rules.find((r) => r.id === id) ?? null;
  const t = (id: RuleId, key: string) => num(rule(id)?.thresholds?.[key]);

  const image = rule("image_resolution");
  const text = rule("min_text_size");
  const minPt = t("min_text_size", "minPt");
  const hairline = rule("hairline");
  const minStroke = t("hairline", "minStrokePt");
  const barcode = rule("barcode_invalid");
  const safe = rule("safe_zone");
  const bleed = rule("bleed");
  const bleedMm = t("bleed", "bleedMm");
  const crease = rule("crosses_crease");
  const acrossFold = rule("barcode_across_fold");
  const glue = rule("crosses_glue");
  const gamut = rule("rgb_out_of_gamut");
  const finishMin = rule("finish_min_feature");
  const minFeature = t("finish_min_feature", "minFeatureMm");
  const rights = rule("element_right_missing");

  for (const el of input.elements) {
    const corners = input.cornersOf(el);
    const sx = Math.abs(el.scaleX) || 1;
    const sy = Math.abs(el.scaleY) || 1;
    // On the sheet if a corner is inside a piece, or a piece's point is inside the element.
    const onSheet = input.outlines.some(
      (o) => corners.some((c) => pointInPolygon(c, o)) || o.some((p) => segmentHitsPolygon(p, p, corners)),
    );
    if (!onSheet) {
      out.push({ ruleId: "off_sheet", severity: "info", elementId: el.id });
      continue;
    }

    // --- the rules packio-api evaluates on the document (the same arithmetic as `evaluateDocument`).
    if (image && el.type === "image" && el.naturalWidth && el.naturalHeight) {
      const warn = num(image.thresholds!.warnBelowPpi);
      const block = num(image.thresholds!.blockBelowPpi);
      const crop = el.crop ?? { width: 1, height: 1 };
      const mmW = el.width * sx;
      const mmH = el.height * sy;
      if (mmW > 0 && mmH > 0) {
        const ppi = Math.floor(
          Math.min(
            (el.naturalWidth * (crop.width ?? 1)) / (mmW / 25.4),
            (el.naturalHeight * (crop.height ?? 1)) / (mmH / 25.4),
          ),
        );
        const severity =
          block !== null && ppi < block ? ("block" as const) : warn !== null && ppi < warn ? image.severity : null;
        if (severity)
          out.push({ ruleId: "image_resolution", severity, elementId: el.id, data: { ppi, min: warn ?? block ?? 0 } });
      }
    }
    if (text && minPt !== null && el.type === "text") {
      const pt = el.fontSize * sy * PT_PER_MM;
      if (pt > 0 && pt < minPt)
        out.push({
          ruleId: "min_text_size",
          severity: text.severity,
          elementId: el.id,
          data: { pt: round(pt), min: minPt },
          fix: "min_text",
        });
    }
    if (hairline && minStroke !== null && (el.type === "rect" || el.type === "circle" || el.type === "shape")) {
      const stroked = typeof el.stroke === "string" && el.stroke !== "" && el.stroke !== "transparent";
      const pt = el.strokeWidth * Math.max(sx, sy) * PT_PER_MM;
      if (stroked && pt > 0 && pt < minStroke)
        out.push({
          ruleId: "hairline",
          severity: hairline.severity,
          elementId: el.id,
          data: { pt: round(pt), min: minStroke },
          fix: "min_stroke",
        });
    }
    if (barcode && el.type === "code") {
      const problems = barcodeProblems(el);
      if (problems.length > 0)
        out.push({
          ruleId: "barcode_invalid",
          severity: barcode.severity,
          elementId: el.id,
          data: { problems: problems.join(",") },
          ...(problems.length === 1 && problems[0] === "too_small" ? { fix: "min_code" as const } : {}),
        });
    }
    if (rights && el.studioElementId && input.undeclared?.has(el.studioElementId))
      out.push({ ruleId: "element_right_missing", severity: rights.severity, elementId: el.id });

    // --- the rules only the studio can see (the die's geometry, the screen's colours).
    const exact = el.type === "text" || el.type === "code";
    if (safe && exact && !insideSafeZone(corners, input.safeZones))
      out.push({ ruleId: "safe_zone", severity: safe.severity, elementId: el.id, fix: "move_inside" });
    const crossesFold = input.folds.some(([a, b]) => segmentHitsPolygon(a, b, corners));
    if (el.type === "code" && acrossFold && crossesFold)
      out.push({ ruleId: "barcode_across_fold", severity: acrossFold.severity, elementId: el.id, fix: "move_inside" });
    else if (el.type === "text" && crease && crossesFold)
      out.push({ ruleId: "crosses_crease", severity: crease.severity, elementId: el.id });
    if (
      glue &&
      input.glueAreas.some(
        (g) => g.some((p) => pointInPolygon(p, corners)) || corners.some((c) => pointInPolygon(c, g)),
      )
    )
      out.push({ ruleId: "crosses_glue", severity: glue.severity, elementId: el.id });
    // Artwork reaching towards a cut should run past it by the bleed.
    if (bleed && bleedMm !== null && !exact && !el.finish) {
      const inside = input.outlines.some((o) => corners.every((c) => pointInPolygon(c, o)));
      const grown = grow(corners, bleedMm);
      if (
        inside &&
        input.outlines.some(
          (o) => grown.some((c) => !pointInPolygon(c, o)) && corners.every((c) => pointInPolygon(c, o)),
        )
      )
        out.push({
          ruleId: "bleed",
          severity: bleed.severity,
          elementId: el.id,
          data: { mm: bleedMm },
          fix: "extend_to_bleed",
        });
    }
    if (gamut && "fill" in el && typeof el.fill === "string" && !el.finish && outOfPrintGamut(el.fill))
      out.push({
        ruleId: "rgb_out_of_gamut",
        severity: gamut.severity,
        elementId: el.id,
        data: { colour: el.fill },
        fix: "in_gamut",
      });
    if (finishMin && minFeature !== null && el.finish) {
      const size =
        el.type === "text"
          ? el.fontSize * sy
          : Math.min(("width" in el ? el.width : 0) * sx, ("height" in el ? el.height : 0) * sy);
      if (size > 0 && size < minFeature)
        out.push({
          ruleId: "finish_min_feature",
          severity: finishMin.severity,
          elementId: el.id,
          data: { mm: round(size), min: minFeature },
        });
    }
  }

  // The spot colours a flexo design uses, counted as packio-api counts them (every fill, stroke and
  // background, and the background pattern).
  const spots = rule("spot_colour_count");
  const maxColours = t("spot_colour_count", "maxColours");
  if (spots && maxColours !== null) {
    const colours = spotColours(input.elements, input.pattern);
    if (colours.size > maxColours)
      out.push({
        ruleId: "spot_colour_count",
        severity: spots.severity,
        elementId: "",
        data: { colours: colours.size, max: maxColours },
        fix: "nearest_spot",
      });
  }
  return out;
}

/** The distinct colours as the spot-colour rule counts them. */
export function spotColours(elements: DesignElement[], pattern?: CheckInput["pattern"]): Set<string> {
  const colours = new Set<string>();
  const add = (c: unknown) => {
    if (typeof c === "string" && c !== "" && c !== "transparent") colours.add(c.toLowerCase());
  };
  for (const el of elements)
    for (const k of ["fill", "stroke", "background"] as const) add((el as unknown as Record<string, unknown>)[k]);
  if (pattern && pattern.kind !== "none") {
    add(pattern.color);
    add(pattern.background);
  }
  return colours;
}
