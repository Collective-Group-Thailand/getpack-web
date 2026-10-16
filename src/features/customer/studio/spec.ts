import { buildConfiguration } from "@/features/customer/configurator/build";
import type { Configurator } from "@/features/customer/configurator/model";
import { stateForDesign } from "./state";
import type { BoxFields } from "@/features/designer/data/api";
import type { DesignContent, DesignSpec } from "@/features/designer/types";
import type { Schemas } from "@/lib/api/types";

/**
 * What a studio design version carries beside its document (D-275): the box — sizes on their
 * basis, material, pattern, print sides — and the **spec**, the calculator configuration the
 * studio prices (`store.studio.quote`, D-277). getpack-api refuses a spec that disagrees with the
 * box (`studio.spec_mismatch`), so both are written from the same configuration here.
 *
 * The spec is the configurator's own configuration for this design (`stateForDesign`): the
 * product's pattern, the design's inside size and material, the inks its artwork needs, and the
 * product's defaults for everything else. The quantities are the quote's, not the spec's.
 */
export type StudioFields = BoxFields & { spec: Record<string, unknown> };

type Part = { printFront?: unknown[]; printBack?: unknown[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown) => (typeof value === "string" && UUID.test(value) ? value : undefined);
const size = (value: unknown) => (typeof value === "number" && value > 0 ? value : undefined);

/** Outside, inside, both or none — as getpack-api reads it from the spec's colours (`studio-spec.ts`). */
export function printSidesOf(configuration: Record<string, unknown>): Schemas["PrintSides"] {
  const has = (value: unknown) =>
    Array.isArray(value) ? value.length > 0 : !!value && typeof value === "object" && Object.keys(value).length > 0;
  const parts = Array.isArray(configuration.parts) ? (configuration.parts as Part[]) : [configuration as Part];
  const front = parts.some((part) => has(part.printFront)) || !!configuration.printColourId;
  const back = parts.some((part) => has(part.printBack));
  return front && back ? "both" : front ? "outside" : back ? "inside" : "none";
}

/** The studio fields of a design on this product, or `null` while the design has no box. */
export function studioFieldsOf(
  configurator: Configurator,
  spec: DesignSpec | null,
  content: DesignContent,
  maxSpot: number | null = null,
): StudioFields | null {
  if (!spec || !configurator.instant) return null;
  const state = stateForDesign(configurator, spec, content, configurator.quantity.default ?? 1, maxSpot);
  const configuration: Record<string, unknown> = { ...buildConfiguration(configurator, state) };
  delete configuration.quantities;
  return {
    ...(id(configuration.patternId) ? { patternId: id(configuration.patternId) } : {}),
    ...(id(configuration.materialId) ? { materialId: id(configuration.materialId) } : {}),
    ...(size(configuration.l) ? { lengthMm: size(configuration.l) } : {}),
    ...(size(configuration.w) ? { widthMm: size(configuration.w) } : {}),
    ...(size(configuration.d) ? { heightMm: size(configuration.d) } : {}),
    ...(typeof configuration.basis === "string"
      ? { measurementBasis: configuration.basis as Schemas["MeasurementBasis"] }
      : {}),
    printSides: printSidesOf(configuration),
    ...(spec.studio?.printMethod ? { printMethod: spec.studio.printMethod } : {}),
    ...(spec.studio?.styleVariantCode ? { styleVariantCode: spec.studio.styleVariantCode } : {}),
    spec: {
      ...configuration,
      ...(spec.studio?.styleVariantCode ? { styleVariantCode: spec.studio.styleVariantCode } : {}),
    },
  };
}
