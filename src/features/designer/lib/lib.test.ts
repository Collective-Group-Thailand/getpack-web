import { describe, expect, it } from "vitest";
import { getStyle, hingeMapOf, REFERENCE_MATERIALS, resolveValues } from "@packio/dieline";

import type { DesignElement, ShapeElement, TextElement } from "../types";
import { alignMoves, distributeMoves } from "./align";
import { designIssues, type CheckInput } from "./checks";
import {
  barsPath,
  EAN_QUIET_LEFT,
  ean13CheckDigit,
  ean13Modules,
  isValidEan13,
  qrMatrix,
  QR_QUIET_MODULES,
} from "./codes";
import { outOfPrintGamut } from "./colour";
import { elementBox, elementCorners, localSize } from "./geometry";
import { snapBox } from "./snapping";
import { uprightAngles } from "./upright";

const base = { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const rect = (id: string, x: number, y: number, w = 10, h = 10): ShapeElement => ({
  ...base,
  id,
  x,
  y,
  type: "rect",
  width: w,
  height: h,
  fill: "#000000",
  stroke: "#000000",
  strokeWidth: 0,
  cornerRadius: 0,
});

describe("codes", () => {
  it("computes EAN-13 check digits and encodes 95 modules plus quiet zones", () => {
    expect(ean13CheckDigit("885123456789")).toBe(ean13CheckDigit("885123456789"));
    const full = `885123456789${ean13CheckDigit("885123456789")}`;
    expect(isValidEan13(full)).toBe(true);
    expect(isValidEan13("8851234567890".replace(/.$/, (d) => String((Number(d) + 1) % 10)))).toBe(false);
    const modules = ean13Modules("885123456789")!;
    expect(modules).toHaveLength(95 + 11 + 7);
    expect(modules.slice(EAN_QUIET_LEFT, EAN_QUIET_LEFT + 3)).toBe("101");
    expect(barsPath("0110")).toBe("M1 0h2v1h-2z");
    expect(ean13Modules("123")).toBeNull();
  });

  it("encodes a QR code with its quiet zone, Thai text included", () => {
    const m = qrMatrix("https://packio.example/สวัสดี")!;
    expect(m.size).toBeGreaterThan(21 + 2 * QR_QUIET_MODULES - 1);
    expect(m.dark(0, 0)).toBe(false);
    expect(m.dark(QR_QUIET_MODULES, QR_QUIET_MODULES)).toBe(true); // a finder pattern corner
  });
});

describe("geometry, snapping and alignment", () => {
  it("rotates an element's corners about its origin", () => {
    const el = { ...rect("r", 0, 0, 20, 10), rotation: 90 };
    const box = elementBox(el, localSize(el));
    expect(box.x).toBeCloseTo(-10, 6);
    expect(box.width).toBeCloseTo(10, 6);
    expect(box.height).toBeCloseTo(20, 6);
  });

  it("snaps the nearest edge or centre within the threshold", () => {
    const r = snapBox({ x: 9, y: 50, width: 10, height: 10 }, { xs: [10, 40], ys: [0] }, 2);
    expect(r.dx).toBe(1);
    expect(r.dy).toBe(0);
    expect(r.guides).toEqual([{ axis: "x", at: 10 }]);
    // The centre (14) snaps to 15.
    expect(snapBox({ x: 9, y: 0, width: 10, height: 10 }, { xs: [15], ys: [] }, 2).dx).toBe(1);
  });

  it("aligns to the selection or a reference, and distributes evenly", () => {
    const items = [
      { id: "a", box: { x: 0, y: 0, width: 10, height: 10 } },
      { id: "b", box: { x: 30, y: 5, width: 20, height: 10 } },
    ];
    expect(alignMoves(items, "left")).toEqual([
      { id: "a", dx: 0, dy: 0 },
      { id: "b", dx: -30, dy: 0 },
    ]);
    expect(alignMoves([items[0]], "center", { x: 0, y: 0, width: 100, height: 100 })[0]).toEqual({
      id: "a",
      dx: 45,
      dy: 0,
    });
    const three = [...items, { id: "c", box: { x: 100, y: 0, width: 10, height: 10 } }];
    const moves = distributeMoves(three, "x");
    // Span 0–110, widths 40 → gaps of 35: b moves to 45.
    expect(moves.find((m) => m.id === "b")!.dx).toBe(15);
  });
});

describe("print checks", () => {
  const square: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  const input = (elements: DesignElement[]): CheckInput => ({
    elements,
    cornersOf: (el) => elementCorners(el, localSize(el)),
    safeZones: [
      [
        [
          [3, 3],
          [97, 3],
          [97, 97],
          [3, 97],
        ],
      ],
    ],
    folds: [
      [
        [50, 0],
        [50, 100],
      ],
    ],
    glueAreas: [],
    outlines: [square],
    bleedMm: 3,
    minDpi: 300,
  });
  const text = (x: number, fontSize = 5): TextElement => ({
    ...base,
    id: "t",
    x,
    y: 20,
    type: "text",
    text: "ab",
    fontSize,
    fontFamily: "x",
    fontStyle: "normal",
    fill: "#000000",
    align: "left",
  });

  it("flags text across a fold, in the danger zone, or too small", () => {
    expect(designIssues(input([text(10)]))).toEqual([]);
    expect(designIssues(input([text(48)])).map((i) => i.code)).toContain("crosses_fold");
    expect(designIssues(input([text(1)])).map((i) => i.code)).toContain("text_in_danger_zone");
    expect(designIssues(input([text(10, 1.5)])).map((i) => i.code)).toContain("small_text");
  });

  it("flags low-resolution images, missing bleed and invalid codes", () => {
    const image = {
      ...base,
      id: "i",
      x: 10,
      y: 10,
      type: "image" as const,
      src: "",
      width: 50.8,
      height: 20,
      naturalWidth: 400,
    };
    const low = designIssues(input([image])).find((i) => i.code === "low_resolution");
    expect(low?.data?.dpi).toBe(200);
    expect(designIssues(input([rect("r", 1, 40)])).map((i) => i.code)).toContain("missing_bleed");
    expect(designIssues(input([rect("r", 10, 40)])).map((i) => i.code)).not.toContain("missing_bleed");
    const code = {
      ...base,
      id: "c",
      x: 60,
      y: 60,
      type: "code" as const,
      kind: "ean13" as const,
      value: "123",
      width: 30,
      height: 20,
      fill: "#000",
      background: "#fff",
    };
    expect(designIssues(input([code])).map((i) => i.code)).toContain("code_invalid");
  });
});

describe("colour and upright faces", () => {
  it("warns on colours a press cannot reach, not on ink-friendly ones", () => {
    expect(outOfPrintGamut("#00ff00")).toBe(true);
    expect(outOfPrintGamut("#0000ff")).toBe(true);
    expect(outOfPrintGamut("#ffe600")).toBe(false);
    expect(outOfPrintGamut("#6b7280")).toBe(false);
  });

  it("keeps the walls upright and turns the top lid to read from the front", () => {
    const style = getStyle("tuck-end");
    const v = resolveValues(style, style.presets[0].values);
    const m = REFERENCE_MATERIALS["board-350"];
    const angles = uprightAngles(style.build(v, m), hingeMapOf(style, v, m)!);
    for (const wall of ["front", "right", "back", "left"]) expect(angles[wall], wall).toBe(0);
    // Hinged at the back, its flat "up" points to the front once closed.
    expect(angles["lid-top"]).toBe(180);
    for (const angle of Object.values(angles)) expect(angle % 90).toBe(0);
  });
});

describe("the checks' view of the sheet", () => {
  it("finds the folds, the glue flap and one outline per piece", async () => {
    const { sheetOf } = await import("./useIssues");
    const style = getStyle("tuck-end");
    const material = REFERENCE_MATERIALS["board-350"];
    const d = style.build(resolveValues(style, { length: 120, width: 60, height: 150 }), material);
    const sheet = sheetOf(d, 3);
    expect(sheet.folds.length).toBeGreaterThan(8);
    expect(sheet.glueAreas).toHaveLength(1);
    expect(sheet.outlines).toHaveLength(d.pieces.length);
    expect(sheet.safeZones.length).toBeGreaterThan(4);
  });
});
