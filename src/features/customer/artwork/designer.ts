import type { Artwork } from "./ArtworkWorkspace";

const DESIGNER_STYLES = new Set(["rsc", "tuck-end", "tray"]);

/** The online designer seeded with this order's box, when the order was set up for it. */
export function designerHrefOf(artwork: Artwork): string | null {
  const { dielineKey, lengthMm, widthMm, heightMm } = artwork.dieline;
  if (artwork.designOption !== "online_designer" || !dielineKey || !DESIGNER_STYLES.has(dielineKey)) return null;
  if (!lengthMm || !widthMm || !heightMm) return null;
  return `/design/new?style=${dielineKey}&l=${lengthMm}&w=${widthMm}&h=${heightMm}`;
}
