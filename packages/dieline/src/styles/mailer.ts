import {
  allowancesOf,
  TRAY_CORNER_FLAP_MAX_MM,
  TRAY_CORNER_FLAP_SHARE,
  TUCK_CORNER_RADIUS_MM,
  tuckDepthFor,
} from "../constants";
import { tuckOnEdge } from "../construct/closures";
import { buildTray } from "../construct/tray";
import { assemble, face, piece } from "../faces";
import { issue, num } from "../params";
import { line, polygon, rectangle } from "../path";
import type { Face, MaterialSpec, ParamValues, Pt } from "../types";
import { defineStyle, grainOn, grainParam, sizeParams, t } from "./_shared";

/**
 * Roll-end tuck-front mailer: a tray whose front and side walls roll over into inner walls, a
 * lid hinged on the back wall with dust flaps (ears) on its sides, a front flap and a tuck.
 * Compensation: base L + a × W + a, walls H + t; inner walls t shorter than their outer wall.
 * ⚠ Simplified locks (no lock tabs/slots) — prepress to confirm against a die sample.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const t0 = m.caliperMm;
  const L = num(v, "length", 250) + a.panel;
  const W = num(v, "width", 180) + a.panel;
  const H = num(v, "height", 80) + a.trayDepth;
  const tuckDepth = num(v, "tuckDepth", tuckDepthFor(L));
  const x0 = H;
  const x1 = H + L;
  const y1 = H + W;
  const lidW = W + t0;
  const inner = H - t0;
  const ear = Math.min(H * 0.9, lidW / 2 - 1);
  const earInset = Math.min(ear * 0.35, lidW / 4);

  const lidFaces = (): Face[] => {
    const yLid = -lidW;
    const yFront = yLid - H;
    const earFace = (id: string, side: "left" | "right"): Face => {
      const x = side === "left" ? x0 : x1;
      const out = side === "left" ? x0 - ear : x1 + ear;
      const pts: Pt[] =
        side === "left"
          ? [
              [x, 0],
              [out, -earInset],
              [out, yLid + earInset],
              [x, yLid],
            ]
          : [
              [x, yLid],
              [out, yLid + earInset],
              [out, -earInset],
              [x, 0],
            ];
      return face(id, "dust_flap", "dust_flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
    };
    return [
      face("lid", "lid", "lid", [
        line([x0, 0], [x0, yLid], "crease"),
        line([x0, yLid], [x1, yLid], "crease"),
        line([x1, yLid], [x1, 0], "crease"),
        line([x1, 0], [x0, 0], "crease"),
      ]),
      earFace("ear-left", "left"),
      earFace("ear-right", "right"),
      face("lid-front", "front", "flap", rectangle(x0, yFront, L, H, { top: "crease", bottom: "crease" })),
      // Walked left to right, so the tuck lies on its upper side, away from the front flap.
      tuckOnEdge("tuck", [x0, yFront], [x1, yFront], tuckDepth, Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2)),
    ];
  };

  const faces = buildTray({
    length: L,
    width: W,
    height: H,
    cornerFlap: Math.min(H * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM),
    wallExtras: {
      "wall-back": lidFaces,
      "wall-front": () => [
        face("inner-front", "inner_wall", "flap", rectangle(x0, y1 + H, L, inner, { top: "crease" })),
      ],
      "wall-left": () => [
        face("inner-left", "inner_wall", "flap", rectangle(-inner, H, inner, W, { right: "crease" })),
      ],
      "wall-right": () => [
        face("inner-right", "inner_wall", "flap", rectangle(x1 + H, H, inner, W, { left: "crease" })),
      ],
    },
  });
  return assemble("mailer", [piece("blank", "blank", faces, grainOn(v, faces, "base"))]);
}

export const mailer = defineStyle({
  id: "mailer",
  category: "corrugated",
  codes: { fefco: "0427" },
  materials: ["corrugated", "paperboard"],
  name: t("กล่องไปรษณีย์ฝาเสียบหน้า (Mailer)", "Roll-end tuck-front mailer"),
  description: t(
    "ผนังพับม้วนสองชั้น ฝาเสียบด้านหน้าพร้อมปีกข้าง ไม่ต้องใช้เทปหรือกาว เหมาะกับอีคอมเมิร์ซและ subscription box",
    "Rolled double walls, a tuck-front lid with side ears, no tape or glue — e-commerce and subscription boxes",
  ),
  params: [
    ...sizeParams({ length: [80, 600], width: [60, 450], height: [20, 250] }),
    {
      key: "tuckDepth",
      kind: "length",
      group: "closure",
      label: t("ความลึกลิ้นเสียบ", "Tuck depth"),
      min: 8,
      max: 60,
      step: 0.5,
      legacyKey: "f",
    },
    grainParam,
  ],
  defaults: { length: 250, width: 180, height: 80, grain: "across" },
  presets: [
    {
      id: "small",
      label: t("เล็ก 200 × 150 × 50", "Small 200 × 150 × 50"),
      values: { length: 200, width: 150, height: 50 },
    },
    {
      id: "medium",
      label: t("กลาง 250 × 180 × 80", "Medium 250 × 180 × 80"),
      values: { length: 250, width: 180, height: 80 },
    },
    {
      id: "large",
      label: t("ใหญ่ 350 × 250 × 100", "Large 350 × 250 × 100"),
      values: { length: 350, width: 250, height: 100 },
    },
  ],
  faces3d: {
    roots: { blank: "base" },
    upright: "base",
    angles: { "inner-front": 180, "inner-left": 180, "inner-right": 180 },
  },
  make,
  check: (v, m) =>
    num(v, "tuckDepth", tuckDepthFor(num(v, "length", 250))) >= num(v, "height", 80) + m.caliperMm
      ? [
          issue(
            "tuck.too_deep",
            t("ลิ้นเสียบลึกเกินความสูงกล่อง", "The tuck is deeper than the box is tall"),
            "tuckDepth",
          ),
        ]
      : [],
  legacy: {
    patternKeys: [
      "pid:20",
      "pid:21",
      "pid:22",
      "pid:23",
      "pid:25",
      "mapping:31",
      "mapping:32",
      "mapping:48",
      "mapping:49",
      "pid:10",
    ],
  },
});
