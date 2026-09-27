import { resolveStyleId } from "@packio/dieline";

import type { Artwork } from "./ArtworkWorkspace";

/** The online designer seeded with this order's box, when the order was set up for it. */
export function designerHrefOf(artwork: Artwork): string | null {
  const { lengthMm, widthMm, heightMm } = artwork.dieline;
  const style = resolveStyleId(artwork.dieline.dielineKey);
  if (artwork.designOption !== "online_designer" || !style) return null;
  if (!lengthMm || !widthMm || !heightMm) return null;
  return `/design/new?style=${style}&l=${lengthMm}&w=${widthMm}&h=${heightMm}`;
}
