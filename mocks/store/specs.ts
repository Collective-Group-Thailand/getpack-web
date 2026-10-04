/**
 * `store.specs.convertDimensions` (U2.1, D-182), mocked the way packio-api converts: a crease at
 * mid-thickness, so a closed box is inside + 1·t over the creases (depth + 2·t) and inside + 2·t
 * outside; a tray's depth takes one caliper; a flat product has its finished size only. The
 * calipers are the catalogue rows' (`materials.caliperMm`) and, for the corrugated mock's flutes,
 * illustrative values by flute — obviously fake, never a production caliper.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { problem } from "../support";
import { byId } from "./catalog";

export type Basis = Schemas["MeasurementBasis"];
export type Family = Schemas["ConstructionFamily"];
export interface Size {
  l: number;
  w: number;
  d: number;
}

const ALLOWANCE: Record<Exclude<Family, "flat">, Record<"external" | "over_crease", Size>> = {
  box: { over_crease: { w: 1, l: 1, d: 2 }, external: { w: 2, l: 2, d: 2 } },
  tray: { over_crease: { w: 1, l: 1, d: 1 }, external: { w: 2, l: 2, d: 1 } },
  sleeve: { over_crease: { w: 1, l: 1, d: 0 }, external: { w: 2, l: 2, d: 0 } },
};

/** Illustrative corrugated calipers by flute (mock only). */
const FLUTE_CALIPER: Record<string, number> = { E: 1.5, B: 3, C: 4, BC: 7 };

const TYPE_FAMILY: Record<string, Family | undefined> = {
  label_sticker: "flat",
  tag_sleeve: "flat",
  flexible_pouch: "flat",
  standard_product: "flat",
  service: "flat",
};

/** A style's construction family: flat products, a tray by its drawing, else a closed box. */
export function familyOf(productTypeCode: string, patternId: string | null | undefined, depth: number): Family {
  const fixed = TYPE_FAMILY[productTypeCode];
  if (fixed) return fixed;
  if (depth <= 0) return "flat";
  const pattern = byId(catalogueRows("patterns"), patternId);
  const key = String(pattern?.dielineKey ?? "");
  return key.includes("tray") ? "tray" : key.includes("sleeve") ? "sleeve" : "box";
}

/** The material's caliper: a board's own, a flute's illustrative one; `null` when unknown. */
export function caliperOf(materialId: string | null | undefined): number | null {
  const material = byId(catalogueRows("materials"), materialId);
  if (typeof material?.caliperMm === "number") return material.caliperMm;
  const flute = byId(catalogueRows("fluteTypes"), materialId);
  return flute ? (FLUTE_CALIPER[String(flute.code)] ?? null) : null;
}

const basesOf = (family: Family): Basis[] =>
  family === "flat" ? ["product"] : ["internal", "external", "over_crease"];
const round2 = (value: number) => Math.round(value * 100) / 100;

export class BasisError extends Error {
  constructor(readonly code: "specs.basis_not_accepted" | "specs.caliper_missing") {
    super(code);
  }
}

/** Every basis of the family from the size on one (millimetres, 0.01), as packio-api answers it. */
export function convert(size: Size, basis: Basis, family: Family, caliperMm: number | null) {
  const bases = basesOf(family);
  if (!bases.includes(basis)) throw new BasisError("specs.basis_not_accepted");
  const none = { internal: null, external: null, overCrease: null, product: null };
  if (family === "flat") return { family, bases, caliperMm, sizes: { ...none, product: size } };
  if (caliperMm === null) {
    const key = basis === "over_crease" ? "overCrease" : basis;
    return { family, bases, caliperMm, sizes: { ...none, [key]: size } };
  }
  const allowance = ALLOWANCE[family];
  const shift = (s: Size, k: Size, sign: 1 | -1): Size => ({
    l: round2(s.l + sign * k.l * caliperMm),
    w: round2(s.w + sign * k.w * caliperMm),
    d: round2(s.d + sign * k.d * caliperMm),
  });
  const internal = basis === "internal" ? size : shift(size, allowance[basis as "external" | "over_crease"], -1);
  return {
    family,
    bases,
    caliperMm,
    sizes: {
      internal,
      external: basis === "external" ? size : shift(internal, allowance.external, 1),
      overCrease: basis === "over_crease" ? size : shift(internal, allowance.over_crease, 1),
      product: null,
    },
  };
}

export const specsHandlers: HttpHandler[] = [
  http.post("*/v1/store/specs/actions/convert-dimensions", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Schemas["ConvertDimensionsDto"] | null;
    if (!body?.productTypeCode || !body.basis || !(body.l >= 0) || !(body.w >= 0))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "basis", code: "required", message: "required" },
      ]);
    if (Object.keys(body).some((key) => /unit/i.test(key)))
      return problem(422, "specs.unit_not_accepted", "ระบบรับขนาดเป็นมิลลิเมตรเท่านั้น");
    const size = { l: body.l, w: body.w, d: body.d ?? 0 };
    try {
      const converted = convert(
        size,
        body.basis,
        familyOf(body.productTypeCode, body.patternId, size.d),
        caliperOf(body.materialId),
      );
      return HttpResponse.json({
        ...converted,
        conversionVersion: "1.0.0",
      } satisfies Schemas["ConvertedDimensionsDto"]);
    } catch (error) {
      if (error instanceof BasisError)
        return problem(
          422,
          error.code,
          error.code === "specs.caliper_missing" ? "ไม่ทราบความหนาของวัสดุ" : "แบบนี้ไม่ได้วัดด้วยฐานนี้",
        );
      throw error;
    }
  }),
];
