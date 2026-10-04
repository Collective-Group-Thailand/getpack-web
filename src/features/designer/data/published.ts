import type { Schemas } from "@/lib/api/types";

/**
 * The published design keeps the designer's document opaque (`DesignDocumentDto.document`); this
 * reads the `{ spec, content }` pair back out of it, on the server or in the browser.
 */
export function documentOf(design: { document?: unknown }): { spec: unknown; content: unknown } | null {
  const document = design.document as { spec?: unknown; content?: unknown } | null | undefined;
  return document && document.spec && document.content ? { spec: document.spec, content: document.content } : null;
}

/**
 * What a studio version carries beside its document (D-275): the box and the calculator `spec` the
 * studio prices. Absent outside the studio — the designer then saves what it always did.
 */
export type BoxFields = Pick<
  Schemas["SaveDesignDto"],
  | "patternId"
  | "materialId"
  | "lengthMm"
  | "widthMm"
  | "heightMm"
  | "measurementBasis"
  | "printMethod"
  | "printSides"
  | "finishes"
  | "styleVariantCode"
> & { spec?: Record<string, unknown> };

/** The box fields a saved design has, as the studio would send them. */
export function boxFieldsOf(design: Schemas["DesignDocumentDto"]): BoxFields {
  return {
    ...(design.patternId ? { patternId: design.patternId } : {}),
    ...(design.materialId ? { materialId: design.materialId } : {}),
    ...(design.lengthMm ? { lengthMm: design.lengthMm } : {}),
    ...(design.widthMm ? { widthMm: design.widthMm } : {}),
    ...(design.heightMm ? { heightMm: design.heightMm } : {}),
    ...(design.spec ? { measurementBasis: design.measurementBasis } : {}),
    ...(design.printMethod ? { printMethod: design.printMethod } : {}),
    ...(design.printSides ? { printSides: design.printSides } : {}),
    ...(design.finishes.length ? { finishes: design.finishes } : {}),
    ...(design.styleVariantCode ? { styleVariantCode: design.styleVariantCode } : {}),
    ...(design.spec ? { spec: design.spec as Record<string, unknown> } : {}),
  };
}
