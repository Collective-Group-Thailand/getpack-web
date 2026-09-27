/**
 * The BoxStudio-era (v1) layouts, frozen. Nothing draws with them any more: they exist so a
 * design saved before engine v2 can find where its artwork sat on the old sheet and be moved onto
 * the same face of the new one (`migrate.ts`). Do not change a number here — it would move
 * existing customers' artwork.
 */
import type { Pt } from "../types";

export type V1StyleId = "rsc" | "tuck-end" | "tray";
export interface V1Dims {
  length: number;
  width: number;
  height: number;
}
export interface V1Face {
  id: string;
  name: string;
  points: Pt[];
  folds: number[];
}
export interface V1Dieline {
  faces: V1Face[];
  width: number;
  height: number;
}

const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const PANEL_NAMES = ["หน้า", "ข้าง", "หลัง", "ข้าง"];

/** Regular slotted carton: glue | L | W | L | W, flaps = W/2 top & bottom. */
function rscV1({ length: L, width: W, height: H }: V1Dims): V1Dieline {
  const g = clamp(Math.min(H, L) * 0.25, 25, 40);
  const f = W / 2;
  const xs = [0, g, g + L, g + L + W, g + 2 * L + W, g + 2 * L + 2 * W];
  const y1 = f;
  const y2 = f + H;
  const y3 = 2 * f + H;
  const taper = Math.min(8, H / 6);
  const faces: V1Face[] = [
    {
      id: "glue",
      name: "ปีกกาว",
      points: [
        [xs[1], y1],
        [0, y1 + taper],
        [0, y2 - taper],
        [xs[1], y2],
      ],
      folds: [3],
    },
  ];
  for (let i = 1; i <= 4; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    faces.push({
      id: `panel-${i}`,
      name: PANEL_NAMES[i - 1],
      points: rect(a, y1, b, y2),
      folds: i < 4 ? [0, 1, 2, 3] : [0, 2, 3],
    });
    faces.push({ id: `top-${i}`, name: "ฝาบน", points: rect(a, 0, b, y1), folds: [2] });
    faces.push({ id: `bottom-${i}`, name: "ฝาล่าง", points: rect(a, y2, b, y3), folds: [0] });
  }
  return { faces, width: xs[5], height: y3 };
}

/** Straight tuck end: lid + tuck on the back panel, dust flaps on side panels. */
function tuckEndV1({ length: L, width: W, height: H }: V1Dims): V1Dieline {
  const g = clamp(Math.min(H, L) * 0.2, 10, 18);
  const t = clamp(W * 0.35, 8, 18);
  const d = Math.min(L * 0.45, W * 0.9);
  const xs = [0, g, g + L, g + L + W, g + 2 * L + W, g + 2 * L + 2 * W];
  const yTop = W + t;
  const yBot = yTop + H;
  const total = yBot + W + t;
  const taper = Math.min(4, H / 10);
  const inset = Math.min(3, W / 8);
  const faces: V1Face[] = [
    {
      id: "glue",
      name: "ปีกกาว",
      points: [
        [xs[1], yTop],
        [0, yTop + taper],
        [0, yBot - taper],
        [xs[1], yBot],
      ],
      folds: [3],
    },
  ];
  for (let i = 1; i <= 4; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const folds = [3];
    if (i < 4) folds.push(1);
    if (i !== 1) folds.push(0, 2);
    faces.push({ id: `panel-${i}`, name: PANEL_NAMES[i - 1], points: rect(a, yTop, b, yBot), folds });

    if (i === 3) {
      faces.push({ id: "lid-top", name: "ฝาบน", points: rect(a, t, b, yTop), folds: [0, 2] });
      faces.push({
        id: "tuck-top",
        name: "ลิ้นเสียบ",
        points: [
          [a + inset, 0],
          [b - inset, 0],
          [b, t],
          [a, t],
        ],
        folds: [2],
      });
      faces.push({ id: "lid-bottom", name: "ฝาล่าง", points: rect(a, yBot, b, yBot + W), folds: [0, 2] });
      faces.push({
        id: "tuck-bottom",
        name: "ลิ้นเสียบ",
        points: [
          [a, yBot + W],
          [b, yBot + W],
          [b - inset, total],
          [a + inset, total],
        ],
        folds: [0],
      });
    }
    if (i === 2 || i === 4) {
      const di = Math.min(inset, (b - a) / 6);
      faces.push({
        id: `dust-top-${i}`,
        name: "ปีกกันฝุ่น",
        points: [
          [a + di, yTop - d],
          [b - di, yTop - d],
          [b, yTop],
          [a, yTop],
        ],
        folds: [2],
      });
      faces.push({
        id: `dust-bottom-${i}`,
        name: "ปีกกันฝุ่น",
        points: [
          [a, yBot],
          [b, yBot],
          [b - di, yBot + d],
          [a + di, yBot + d],
        ],
        folds: [0],
      });
    }
  }
  return { faces, width: xs[5], height: total };
}

/** Open tray: cross layout with glue tabs on the side walls. */
function trayV1({ length: L, width: W, height: H }: V1Dims): V1Dieline {
  const td = Math.min(H * 0.85, 20);
  const inset = Math.min(3, H / 6);
  const faces: V1Face[] = [
    { id: "base", name: "ฐาน", points: rect(H, H, H + L, H + W), folds: [0, 1, 2, 3] },
    { id: "wall-back", name: "ผนังหลัง", points: rect(H, 0, H + L, H), folds: [2] },
    { id: "wall-front", name: "ผนังหน้า", points: rect(H, H + W, H + L, 2 * H + W), folds: [0] },
    { id: "wall-left", name: "ผนังซ้าย", points: rect(0, H, H, H + W), folds: [0, 1, 2] },
    { id: "wall-right", name: "ผนังขวา", points: rect(H + L, H, 2 * H + L, H + W), folds: [0, 2, 3] },
  ];
  for (const [side, a, b] of [
    ["l", 0, H],
    ["r", H + L, 2 * H + L],
  ] as const) {
    faces.push({
      id: `tab-${side}-top`,
      name: "ปีกกาว",
      points: [
        [a + inset, H - td],
        [b - inset, H - td],
        [b, H],
        [a, H],
      ],
      folds: [2],
    });
    faces.push({
      id: `tab-${side}-bottom`,
      name: "ปีกกาว",
      points: [
        [a, H + W],
        [b, H + W],
        [b - inset, H + W + td],
        [a + inset, H + W + td],
      ],
      folds: [0],
    });
  }
  return { faces, width: 2 * H + L, height: 2 * H + W };
}

export function buildDielineV1(style: V1StyleId, dims: V1Dims): V1Dieline {
  switch (style) {
    case "rsc":
      return rscV1(dims);
    case "tuck-end":
      return tuckEndV1(dims);
    case "tray":
      return trayV1(dims);
  }
}
