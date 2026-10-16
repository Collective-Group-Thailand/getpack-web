import type { StudioStep } from "./steps";

/**
 * Every way into getpack 3D Studio (U4.2 §1): the style library, a product page, the configurator,
 * an order's artwork page, the account's designs, a shared design, LINE (LIFF opens the same
 * links) — each lands on `/studio/…` with the step that fits what is already known: ① to pick a
 * box, ② when the style is chosen but not yet its size and material, ③ once the box is set.
 */
export interface StudioEntry {
  designId?: string;
  product?: string | null;
  /** The engine style and inside size (mm), when the box is already known. */
  style?: string | null;
  dims?: { l: number; w: number; h: number } | null;
  /**
   * A published variant of the style library (D-407): its base and variant codes, and the engine
   * variant (`variantKey`) of the recipe in `style` that draws it — the studio opens on that shape.
   */
  variant?: { base: string; code: string; key: string } | null;
  pattern?: string | null;
  material?: string | null;
  template?: string | null;
  order?: { orderId: string; itemId: string; orderCode: string } | null;
  step?: StudioStep;
}

export function studioHref(entry: StudioEntry = {}): string {
  const query = new URLSearchParams();
  if (entry.product) query.set("product", entry.product);
  if (entry.style && entry.dims) {
    query.set("style", entry.style);
    query.set("l", String(entry.dims.l));
    query.set("w", String(entry.dims.w));
    query.set("h", String(entry.dims.h));
    if (entry.variant) {
      query.set("base", entry.variant.base);
      query.set("sv", entry.variant.code);
      query.set("rv", entry.variant.key);
    }
  }
  if (entry.pattern) query.set("pattern", entry.pattern);
  if (entry.material) query.set("material", entry.material);
  if (entry.template) query.set("template", entry.template);
  if (entry.order) {
    query.set("order", entry.order.orderId);
    query.set("item", entry.order.itemId);
    query.set("orderCode", entry.order.orderCode);
  }
  const step = entry.step ?? (entry.designId || (entry.style && entry.dims) ? "design" : "start");
  query.set("step", step);
  return `/studio/${entry.designId ?? "new"}?${query.toString()}`;
}
