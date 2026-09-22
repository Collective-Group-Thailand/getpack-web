import type { BoxDims, BoxStyleId, Dieline, Face, Pt } from "./types";

const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const PANEL_NAMES = ["หน้า", "ข้าง", "หลัง", "ข้าง"];

/** Regular slotted carton: glue | L | W | L | W, flaps = W/2 top & bottom. */
function rsc({ length: L, width: W, height: H }: BoxDims): Dieline {
  const g = clamp(Math.min(H, L) * 0.25, 25, 40);
  const f = W / 2;
  const xs = [0, g, g + L, g + L + W, g + 2 * L + W, g + 2 * L + 2 * W];
  const y1 = f;
  const y2 = f + H;
  const y3 = 2 * f + H;
  const taper = Math.min(8, H / 6);
  const faces: Face[] = [
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
function tuckEnd({ length: L, width: W, height: H }: BoxDims): Dieline {
  const g = clamp(Math.min(H, L) * 0.2, 10, 18);
  const t = clamp(W * 0.35, 8, 18);
  const d = Math.min(L * 0.45, W * 0.9);
  const xs = [0, g, g + L, g + L + W, g + 2 * L + W, g + 2 * L + 2 * W];
  const yTop = W + t;
  const yBot = yTop + H;
  const total = yBot + W + t;
  const taper = Math.min(4, H / 10);
  const inset = Math.min(3, W / 8);
  const faces: Face[] = [
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
function tray({ length: L, width: W, height: H }: BoxDims): Dieline {
  const td = Math.min(H * 0.85, 20);
  const inset = Math.min(3, H / 6);
  const faces: Face[] = [
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

export function buildDieline(style: BoxStyleId, dims: BoxDims): Dieline {
  switch (style) {
    case "rsc":
      return rsc(dims);
    case "tuck-end":
      return tuckEnd(dims);
    case "tray":
      return tray(dims);
  }
}

export interface Segment {
  a: Pt;
  b: Pt;
  kind: "cut" | "fold";
}

/** Edge list with duplicate fold edges removed. */
export function dielineSegments(d: Dieline): Segment[] {
  const seen = new Set<string>();
  const out: Segment[] = [];
  const key = (a: Pt, b: Pt) => {
    const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
    return `${p[0].toFixed(3)},${p[1].toFixed(3)}-${q[0].toFixed(3)},${q[1].toFixed(3)}`;
  };
  for (const f of d.faces) {
    f.points.forEach((a, i) => {
      const b = f.points[(i + 1) % f.points.length];
      const kind = f.folds.includes(i) ? "fold" : "cut";
      const k = kind + key(a, b);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ a, b, kind });
    });
  }
  return out;
}

export function faceCentroid(f: Face): Pt {
  const xs = f.points.map((p) => p[0]);
  const ys = f.points.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

export function dielineToSvg(d: Dieline, margin = 5): string {
  const segs = dielineSegments(d);
  const r = (n: number) => +(n + margin).toFixed(3);
  const line = (s: Segment) => `<line x1="${r(s.a[0])}" y1="${r(s.a[1])}" x2="${r(s.b[0])}" y2="${r(s.b[1])}" />`;
  const size = (n: number) => +n.toFixed(3);
  const w = d.width + margin * 2;
  const h = d.height + margin * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size(w)}mm" height="${size(h)}mm" viewBox="0 0 ${size(w)} ${size(h)}">
  <g id="CUT" stroke="#ff0000" stroke-width="0.25" fill="none">${segs
    .filter((s) => s.kind === "cut")
    .map(line)
    .join("")}</g>
  <g id="CREASE" stroke="#0066ff" stroke-width="0.25" stroke-dasharray="3 2" fill="none">${segs
    .filter((s) => s.kind === "fold")
    .map(line)
    .join("")}</g>
</svg>`;
}
