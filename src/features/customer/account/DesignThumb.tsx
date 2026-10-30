"use client";

import { useFileUrl } from "@/features/customer/files/files";
import { CardImage } from "@/ui/components/CardImage";
import { LINE_PLATE, ProductIllustration } from "@/ui/components/ProductIllustration";

/**
 * A design's thumbnail, or the words for none. Prefer `url`: the API's own signed URL, ready for
 * an `<img>` (`LaunchpadDesignDto.thumbnailUrl`, 5 minutes) — the web no longer resolves the file
 * itself there. Without one, `fileId` goes through a signed URL (`store.files.download`). An image
 * that fails to load shows the same words, never a broken-image icon.
 */
export function DesignThumb({ url, fileId, empty }: { url?: string | null; fileId?: string | null; empty: string }) {
  const resolved = useFileUrl(url ? null : (fileId ?? null));
  const src = url ?? resolved;
  // No picture yet, or one that fails (an expired signed URL — even before the page's script runs): the neutral
  // thin-line drawing of a carton with the words under it (Project A/B: never a broken-image icon or a grey tile).
  const drawing = (
    <span className={`${LINE_PLATE} flex h-full w-full flex-col items-center justify-center gap-1.5 p-3`}>
      <ProductIllustration family="tuck" className="max-w-16" />
      <span className="text-muted text-center text-xs">{empty}</span>
    </span>
  );
  return src ? (
    // A signed URL next/image cannot optimise; the design's title beside it is the label.
    <CardImage key={src} src={src} alt="" className="h-full w-full object-contain" loading="lazy" fallback={drawing} />
  ) : (
    drawing
  );
}
