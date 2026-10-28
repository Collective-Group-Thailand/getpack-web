"use client";

import { getStyle, REFERENCE_MATERIALS } from "@getpack/dieline";

import { BoxPreview } from "@/features/designer/components/BoxPreview";

/**
 * The mini editor's flat sheet: the hero shape's own dieline at the chosen size, drawn by `@getpack/dieline` (the
 * studio's engine). Loaded after the page (dynamic, no SSR); a size the style cannot draw shows nothing.
 */
export default function MiniFlat({
  styleId,
  size,
  corrugated,
  label,
}: {
  styleId: string;
  size: { lengthMm: number; widthMm: number; heightMm: number };
  corrugated: boolean;
  label: string;
}) {
  const material = REFERENCE_MATERIALS[corrugated ? "flute-e" : "board-350"]!;
  let values: Record<string, unknown>;
  try {
    values = { ...getStyle(styleId).defaults, length: size.lengthMm, width: size.widthMm, height: size.heightMm };
    getStyle(styleId).build(values as never, material);
  } catch {
    return null;
  }
  return <BoxPreview styleId={styleId} values={values as never} material={material} label={label} />;
}
