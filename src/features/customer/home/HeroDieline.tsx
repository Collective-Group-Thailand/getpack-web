"use client";

import { getStyle, REFERENCE_MATERIALS } from "@getpack/dieline";

import { BoxPreview } from "@/features/designer/components/BoxPreview";

/**
 * The hero panel's flat view: the selected shape's own dieline at the selected size, drawn by
 * `@getpack/dieline` (the studio's engine), so "แผ่นคลี่" is the blank the factory cuts. Loaded only
 * when the customer switches to it, so the home page does not ship the engine up front. A size the
 * style cannot draw shows `fallback` rather than failing the panel.
 */
export default function HeroDieline({
  styleId,
  size,
  corrugated,
  label,
  fallback,
}: {
  styleId: string;
  size: { lengthMm: number; widthMm: number; heightMm: number };
  corrugated: boolean;
  label: string;
  fallback: string;
}) {
  const material = REFERENCE_MATERIALS[corrugated ? "flute-e" : "board-350"]!;
  let values: Record<string, unknown>;
  try {
    values = { ...getStyle(styleId).defaults, length: size.lengthMm, width: size.widthMm, height: size.heightMm };
    getStyle(styleId).build(values as never, material);
  } catch (error) {
    console.warn(`home: no flat view for ${styleId}`, error);
    return <p className="text-muted max-w-[18em] text-center text-[13px]">{fallback}</p>;
  }
  return (
    <div className="absolute inset-x-[7%] top-12 bottom-9">
      <BoxPreview styleId={styleId} values={values as never} material={material} label={label} />
    </div>
  );
}
