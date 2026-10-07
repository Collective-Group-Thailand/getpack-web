import { getStyle, REFERENCE_MATERIALS, resolveStyleId } from "@packio/dieline";

import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { ProductPlate, type ProductFamily } from "@/ui/components/ProductIllustration";

/**
 * A product's picture before it has a photo: its own flat dieline on the designer's dotted canvas,
 * drawn by `@packio/dieline` at the product's first standard size (UX audit: "gallery ใช้ dieline/3D
 * render ของแบบกล่องแทน placeholder"); the family's drawing when the product has no dieline.
 */
export function ProductPicture({
  dielineKey,
  size,
  family,
  badge,
  label,
  caption,
}: {
  dielineKey: string | null;
  size: { lengthMm: number; widthMm: number; heightMm: number } | null;
  family: ProductFamily;
  badge?: React.ReactNode;
  label: string;
  caption: string;
}) {
  const id = resolveStyleId(dielineKey);
  const values = id
    ? {
        ...getStyle(id).defaults,
        ...(size ? { length: size.lengthMm, width: size.widthMm, height: size.heightMm } : {}),
      }
    : null;
  // A size the style cannot draw falls back to the drawing rather than failing the page.
  let style = id;
  if (id && values) {
    try {
      getStyle(id).build(values, REFERENCE_MATERIALS["board-350"]);
    } catch {
      style = null;
    }
  }
  return (
    <figure className="border-border bg-surface pk-dot-grid rounded-card relative aspect-[4/3] overflow-hidden border">
      {style ? (
        <div className="absolute inset-[12%]">
          <BoxPreview styleId={style} values={values!} label={label} />
        </div>
      ) : (
        // Large, as on the "ProductDetail" board — the drawing is the picture until there is a photo.
        <ProductPlate family={family} className="h-full [&_svg]:w-[58%] [&_svg]:max-w-[22rem]" />
      )}
      {badge ? <div className="absolute start-4 top-4">{badge}</div> : null}
      <figcaption className="bg-surface/90 text-muted border-border absolute end-4 bottom-4 rounded-control border px-3 py-1 text-xs">
        {caption}
      </figcaption>
    </figure>
  );
}
