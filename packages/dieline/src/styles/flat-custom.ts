import { issue, num, str } from "../params";
import { boundsOf, flattenContour, mapEdge, rectangle } from "../path";
import { parseSvgPath } from "../svgpath";
import type { Contour } from "../types";
import { flatDieline, FLAT_MATERIALS } from "./_flat";
import { defineStyle, t } from "./_shared";

/** A 40 mm rounded star, the default custom shape — any closed SVG path works. */
const SAMPLE_PATH = "M20 0 L25 14 L40 15 L28 24 L32 40 L20 31 L8 40 L12 24 L0 15 L15 14 Z";

function customOutline(path: string, size: number): Contour | null {
  let contours: Contour[];
  try {
    contours = parseSvgPath(path);
  } catch {
    return null;
  }
  if (contours.length === 0) return null;
  // The largest subpath is the outline; smaller ones would be holes, which a sticker die rarely has.
  const measured = contours.map((c) => ({ c, b: boundsOf(flattenContour(c, 0.5)) }));
  measured.sort((p, q) => q.b.width * q.b.height - p.b.width * p.b.height);
  const { c, b } = measured[0];
  const longest = Math.max(b.width, b.height);
  if (!(longest > 0)) return null;
  const k = size / longest;
  return c.map((e) => mapEdge(e, (p) => [(p[0] - b.x) * k, (p[1] - b.y) * k]));
}

export const flatCustom = defineStyle({
  id: "flat-custom",
  category: "flat",
  materials: FLAT_MATERIALS,
  name: t("รูปทรงอิสระจากไฟล์ SVG", "Custom shape from an SVG path"),
  description: t(
    "อัปโหลดเส้นรอบรูปเป็น SVG path ระบบย่อ-ขยายให้ด้านที่ยาวที่สุดเท่ากับขนาดที่กำหนด",
    "Upload the outline as an SVG path; it is scaled so its longest side is the size you set",
  ),
  params: [
    {
      key: "size",
      kind: "length",
      group: "size",
      label: t("ขนาดด้านที่ยาวที่สุด", "Longest side"),
      min: 10,
      max: 1000,
      step: 0.5,
    },
    { key: "path", kind: "text", group: "size", label: t("เส้นรอบรูป (SVG path)", "Outline (SVG path data)") },
  ],
  defaults: { size: 60, path: SAMPLE_PATH },
  presets: [{ id: "star", label: t("ดาว 60 มม.", "Star, 60 mm"), values: { size: 60, path: SAMPLE_PATH } }],
  make: (v) =>
    flatDieline(
      "flat-custom",
      customOutline(str(v, "path", SAMPLE_PATH), num(v, "size", 60)) ??
        rectangle(0, 0, num(v, "size", 60), num(v, "size", 60)),
    ),
  check: (v) =>
    customOutline(str(v, "path", SAMPLE_PATH), num(v, "size", 60))
      ? []
      : [issue("path.invalid", t("อ่านเส้นรอบรูปจาก SVG ไม่ได้", "The SVG outline could not be read"), "path")],
  legacy: { patternKeys: [] },
});
