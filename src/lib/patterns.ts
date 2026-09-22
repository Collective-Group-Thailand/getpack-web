import type { PatternSettings } from "./types";

/** Builds a repeatable tile canvas. `pxPerMm` sets tile resolution. */
export function buildPatternTile(p: PatternSettings, pxPerMm = 8): HTMLCanvasElement | null {
  if (typeof document === "undefined" || p.kind === "none" || p.kind === "solid") return null;
  const s = Math.max(4, Math.round(p.size * pxPerMm));
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  switch (p.kind) {
    case "stripes": {
      ctx.lineWidth = s * 0.25;
      for (let o = -s; o <= s * 2; o += s) {
        ctx.beginPath();
        ctx.moveTo(o, s);
        ctx.lineTo(o + s, 0);
        ctx.stroke();
      }
      break;
    }
    case "dots": {
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "grid": {
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.strokeRect(0, 0, s, s);
      break;
    }
    case "checker": {
      ctx.fillRect(0, 0, s / 2, s / 2);
      ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
      break;
    }
  }
  return c;
}

export const PATTERN_OPTIONS: { kind: PatternSettings["kind"]; label: string }[] = [
  { kind: "none", label: "ไม่มี" },
  { kind: "solid", label: "สีพื้น" },
  { kind: "stripes", label: "ลายทาง" },
  { kind: "dots", label: "ลายจุด" },
  { kind: "grid", label: "ตาราง" },
  { kind: "checker", label: "ตาหมากรุก" },
];
