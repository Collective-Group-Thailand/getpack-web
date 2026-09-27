import { resolveStyleId } from "@packio/dieline";

import type { Artwork } from "./ArtworkWorkspace";

/**
 * The online designer seeded with this order's box and linked to it (F4 C.2, legacy
 * `design_uuid`), when the order was set up for it — so the finished design can be sent to print
 * as this order's artwork. An order is one product line in Packio, so the line is the order.
 */
export function designerHrefOf(artwork: Artwork): string | null {
  const { lengthMm, widthMm, heightMm } = artwork.dieline;
  const style = resolveStyleId(artwork.dieline.dielineKey);
  if (artwork.designOption !== "online_designer" || !style) return null;
  if (!lengthMm || !widthMm || !heightMm) return null;
  const query = new URLSearchParams({
    style,
    l: String(lengthMm),
    w: String(widthMm),
    h: String(heightMm),
    order: artwork.orderId,
    item: artwork.orderId,
    orderCode: artwork.orderCode,
  });
  return `/design/new?${query.toString()}`;
}
