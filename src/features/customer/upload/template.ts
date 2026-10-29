import { dielineToPdf, getStyle, REFERENCE_MATERIALS, type MaterialSpec } from "@getpack/dieline";

import { boxStyleOf } from "@/features/customer/configurator/ConfiguratorPreview";
import { initialState, type Configurator } from "@/features/customer/configurator/state";

/**
 * The template of a product at one of its standard sizes (upload redesign Phase 1 item 3): the same engine as the
 * Studio and the API's check (`@getpack/dieline`), from the product's pattern. The PDF carries the die on its own spot
 * layers (`CutContour`, `Crease` — what the check reads), TrimBox = the die, BleedBox = + the bleed of the rules.
 */
export function templateStyleOf(configurator: Configurator) {
  return boxStyleOf(configurator, initialState(configurator));
}

/** The reference board of the product's calculator (corrugated B flute, else 350 g board). */
export function referenceMaterial(configurator: Pick<Configurator, "calculator">): MaterialSpec {
  return configurator.calculator === "corrugate" ? REFERENCE_MATERIALS["flute-b"]! : REFERENCE_MATERIALS["board-350"]!;
}

export function templatePdf(
  styleId: string,
  size: { lengthMm: number; widthMm: number; heightMm: number },
  material: MaterialSpec,
  options: { bleedMm: number; title: string },
): Uint8Array {
  const style = getStyle(styleId);
  const dieline = style.build(
    { ...style.defaults, length: size.lengthMm, width: size.widthMm, height: size.heightMm },
    material,
  );
  return dielineToPdf(dieline, { bleedMm: options.bleedMm, title: options.title });
}
